import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import WebPush from "npm:web-push";

Deno.serve(async (req) => {
    // 1. Security Check
    const authHeader = req.headers.get("Authorization") || "";
    const envKey = Deno.env.get("MY_NOTIFICATION_SECRET") || "";

    console.log("Header starts with:", authHeader.substring(0, 17)); // Should be "Bearer eyJhbG..."
    console.log("Env Key starts with:", envKey.substring(0, 10));    // Should be "eyJhbG..."

    if (authHeader !== `Bearer ${envKey}`) {
        return new Response("Unauthorized", { status: 401 });
    }

    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    WebPush.setVapidDetails(
        "mailto:mekristaps@gmail.com",
        Deno.env.get("VAPID_PUBLIC_KEY")!,
        Deno.env.get("VAPID_PRIVATE_KEY")!,
    );

    let payload: any = {};
    try {
        payload = await req.json();
    } catch {
        // Fallback for Cron
    }

    const notifications: any = [];
    // Add this log to see what is actually arriving
    
    // --- CASE A: ADMIN NOTIFICATION (TRIGGER) ---
    // --- CASE A: ADMIN NOTIFICATION (JOIN / UNREG) ---
    // --- CASE A: ADMIN & PLAYER NOTIFICATIONS (JOIN / UNREG) ---
    if (payload?.type === 'admin_notification' || payload?.type === 'admin_unreg') {
        const isJoin = payload.type === 'admin_notification';
        
        try {
            let profileId = payload.profile_id;
            let sessionId = payload.session_id;

            if (isJoin && payload.registration_id) {
                const { data: r } = await supabase
                    .from('registrations')
                    .select('profile_id, session_id')
                    .eq('id', payload.registration_id)
                    .single();
                if (r) {
                    profileId = r.profile_id;
                    sessionId = r.session_id;
                }
            }

            // Fetch Profile, Session, AND all currently registered players with their push subs
            const [{ data: profile }, { data: session }] = await Promise.all([
                supabase.from('profiles').select('full_name').eq('id', profileId).single(),
                supabase.from('sessions').select(`
                    id, arena_name, start_time, 
                    registrations ( 
                        profiles ( id, is_admin, push_subscriptions ( subscription_json ) ) 
                    )
                `).eq('id', sessionId).single()
            ]);

            if (!profile || !session) return new Response("Data not found", { status: 404 });

            // Format Date/Time (Latvian style with Riga Timezone)
            const dateObj = new Date(session.start_time);
            const formattedDate = dateObj.toLocaleDateString('lv-LV', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Europe/Riga' }).replace(/\//g, '.');
            const formattedTime = dateObj.toLocaleTimeString('lv-LV', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Riga' });

            const sessionInfo = `${session.arena_name} (${formattedDate} | ${formattedTime})`;
            const playerCount = session.registrations?.length || 0;
            
            // 1. ADMIN NOTIFICATION LOGIC
            let adminTitle = isJoin ? "Jauns spēlētājs! 🏒" : "Spēlētājs atteicās ❌";
            if (isJoin && playerCount === 6) adminTitle = "Minimums sasniegts! ✅ (6/6)";

            const adminMsg = JSON.stringify({
                title: adminTitle,
                body: `${profile.full_name} ${isJoin ? 'pieteicās' : 'atteicās'}: ${sessionInfo}. Kopā: ${playerCount}`,
                url: `/sessions/${session.id}`
            });

            // Get Admins
            const { data: admins } = await supabase.from('profiles').select('id, push_subscriptions(subscription_json)').eq('is_admin', true);
            
            admins?.forEach((admin: any) => {
                admin.push_subscriptions?.forEach((sub: any) => {
                    notifications.push(WebPush.sendNotification(sub.subscription_json, adminMsg));
                });
            });

            // 2. PLAYER "GAME ON" NOTIFICATION (Only if count hits exactly 6)
            if (isJoin && playerCount === 6) {
                const playerMsg = JSON.stringify({
                    title: "Sastāvs savākts! 🏒✅",
                    body: `Minimums (6/6) sasniegts spēlei: ${sessionInfo}. Tiekamies laukumā!`,
                    url: `/sessions/${session.id}`
                });

                session.registrations?.forEach((reg: any) => {
                    const p = reg.profiles;
                    // Only send to non-admins (admins already got the admin alert)
                    if (p && !p.is_admin) {
                        p.push_subscriptions?.forEach((sub: any) => {
                            notifications.push(WebPush.sendNotification(sub.subscription_json, playerMsg));
                        });
                    }
                });
            }

        } catch (err: any) {
            console.error("Crash:", err);
            return new Response(err.message, { status: 500 });
        }
    }

    // --- CASE B: PLAYER REMINDERS (CRON) ---
    else {
        const now = new Date();
        const sixtyMins = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
        const ninetyMins = new Date(now.getTime() + 90 * 60 * 1000).toISOString();

        const { data: games } = await supabase
            .from("games")
            .select(`
                id, arena_name, start_time,
                game_registrations (
                    profiles ( push_subscriptions ( subscription_json ) )
                )
            `)
            .gt("start_time", sixtyMins)
            .lt("start_time", ninetyMins);

        games?.forEach((game: any) => {
            game.game_registrations?.forEach((reg: any) => {
                reg.profiles?.push_subscriptions?.forEach((sub: any) => {
                    notifications.push(
                        WebPush.sendNotification(
                            sub.subscription_json,
                            JSON.stringify({
                                title: "Hokeja Atgādinājums! 🏒",
                                body: `Spēle "${game.arena_name}" sākas pēc stundas!`,
                                url: `/games/${game.id}`,
                            }),
                        ),
                    );
                });
            });
        });
    }

    // Final execution of all collected promises
    await Promise.all(
        notifications.map((p: any) =>
            p.catch((e: any) => console.error("Push Error Detail:", e)),
        ),
    );

    return new Response(JSON.stringify({ processed: notifications.length }), {
        headers: { "Content-Type": "application/json" },
    });
});