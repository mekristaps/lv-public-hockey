import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import WebPush from "npm:web-push";

Deno.serve(async (req) => {
    // 1. Security Check
    const authHeader = req.headers.get("Authorization") || "";
    const envKey = Deno.env.get("MY_NOTIFICATION_SECRET") || "";

    //console.log("Header starts with:", authHeader.substring(0, 17)); // Should be "Bearer eyJhbG..."
    //console.log("Env Key starts with:", envKey.substring(0, 10));    // Should be "eyJhbG..."

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
        //console.log("Payload received:", payload);
    } catch (e) {
        // Fallback for Cron
        console.error("JSON Parse Error:", e);
    }

    const notifications: any = [];
    
    // --- CASE F: MINIMUM REACHED (6/6) ---
    if (payload?.type === 'min_reached') {
        try {
            const { data: session, error } = await supabase
                .from('sessions')
                .select(`
                    id, arena_name, start_time,
                    registrations ( 
                        profiles ( push_subscriptions ( subscription_json ) ) 
                    )
                `)
                .eq('id', payload.session_id)
                .single();

            if (error || !session) return new Response("Session not found", { status: 404 });

            const dateObj = new Date(session.start_time);
            const formattedTime = dateObj.toLocaleTimeString('lv-LV', { 
                hour: '2-digit', 
                minute: '2-digit',
            });

            const msg = JSON.stringify({
                title: "Sastāvs savākts! 🏒✅",
                body: `Pieteikušies 6 spēlētāji - ${session.arena_name} plkst. ${formattedTime}. Tiekamies!`,
                url: `/#session-${session.id}`
            });

            // Notify everyone in this session
            session.registrations?.forEach((reg: any) => {
                reg.profiles?.push_subscriptions?.forEach((sub: any) => {
                    notifications.push(WebPush.sendNotification(sub.subscription_json, msg));
                });
            });

        } catch (err: any) {
            console.error("Min reached error:", err.message);
        }
    }
    // --- CASE C: SESSION SYNC UPDATES (TIME CHANGE / CANCELLATION) ---
    else if (payload?.type === 'session_update' || payload?.type === 'session_cancellation') {
        const isUpdate = payload.type === 'session_update';

        try {
            let subscribers;
            // Direct query to registrations is more reliable
            // Check if the DB already gave us the IDs
            if (payload.subscriber_ids && payload.subscriber_ids.length > 0) {
                const { data, error: profError } = await supabase
                    .from('profiles')
                    .select(`
                        push_subscriptions ( id, subscription_json )
                    `)
                    .in('id', payload.subscriber_ids);
                
                if (profError) throw profError;
                // Map to match your existing 'reg.profiles' structure
                subscribers = data?.map(p => ({ profiles: p }));
            } else {
                // Fallback for manual calls or if IDs weren't passed
                const { data, error: subError } = await supabase
                    .from('registrations')
                    .select('profiles ( push_subscriptions ( id, subscription_json ) )')
                    .eq('session_id', payload.session_id);
                    
                if (subError) throw subError;
                subscribers = data;
            }

            if (!subscribers || subscribers.length === 0) {
                return new Response("No subscribers found", { status: 200 });
            }

            // 2. Formatting Helpers for the Payload Data
            const dateObj = new Date(payload.old_time);
            const formattedDate = dateObj.toLocaleDateString('lv-LV', {
                day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Europe/Riga'
            }).replace(/\//g, '.');

            const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('lv-LV', {
                hour: '2-digit', minute: '2-digit', hour12: false
            });

            // sessionInfo constructed from Payload
            const sessionInfo = `${payload.arena_name} (${formattedDate} | ${formatTime(payload.old_time)})`;

            // 3. Build the Strings exactly as requested
            const title = isUpdate ? "Izmaiņas laikā! 🕒" : "ATCELTS! ❌";
            const body = isUpdate
                ? `${sessionInfo} - pārcelts laiks no ${formatTime(payload.old_time)} ➡️ ${formatTime(payload.new_time)}`
                : `${sessionInfo} - atcelts ❌!`;

            const msg = JSON.stringify({ title, body, url: "/" });

            // Populate the notifications array
            subscribers.forEach((reg: any) => {
                reg.profiles?.push_subscriptions?.forEach((sub: any) => {
                    if (sub.subscription_json) {
                        notifications.push(
                            WebPush.sendNotification(sub.subscription_json, msg)
                                .then(() => ({ success: true }))
                                .catch(async (err: any) => {
                                    if (err.statusCode === 410 || err.statusCode === 404) {
                                        // Cleanup dead token
                                        await supabase.from('push_subscriptions').delete().eq('id', sub.id);
                                    }
                                    return { success: false };
                                })
                        );
                    }
                });
            });

        } catch (err: any) {
            console.error("Sync notification error:", err);
            return new Response(JSON.stringify({ error: err.message }), { status: 500 });
        }
    }
    // --- CASE A: ADMIN & PLAYER NOTIFICATIONS (JOIN / UNREG) ---
    else if (payload?.type === 'admin_notification' || payload?.type === 'admin_unreg') {
        const isJoin = payload.type === 'admin_notification';
        const dbOp = payload.op; // 'INSERT' or 'UPDATE'
        const oldGuests = payload.old_guests || 0;
        const newGuests = payload.new_guests || 0;
        const isGuestChange = dbOp === 'UPDATE' && oldGuests !== newGuests;

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
                        guests_count,
                        profiles ( id, is_admin, push_subscriptions ( subscription_json ) ) 
                    )
                `).eq('id', sessionId).single()
            ]);

            if (!profile || !session) return new Response("Data not found", { status: 404 });

            // Format Date/Time (Latvian style with Riga Timezone)
            const dateObj = new Date(session.start_time);
            const formattedDate = dateObj.toLocaleDateString('lv-LV', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Europe/Riga' }).replace(/\//g, '.');
            const formattedTime = dateObj.toLocaleTimeString('lv-LV', { hour: '2-digit', minute: '2-digit', hour12: false });

            const sessionInfo = `${session.arena_name} (${formattedDate} | ${formattedTime})`;
            // Calculate total players: Count of rows + sum of all guests_count
            const playerCount = (session.registrations?.length || 0) + 
                session.registrations.reduce((sum: number, r: any) => sum + (r.guests_count || 0), 0);
            //const playerCount = session.registrations?.length || 0;
            
            // 1. ADMIN NOTIFICATION LOGIC
            let adminTitle = isJoin ? "Jauns spēlētājs! 🏒" : "Spēlētājs atteicās! ❌";
            let actionText = isJoin ? 'pieteicās' : 'atteicās';

            // Custom logic for guest updates
            if (isGuestChange) {
                const diff = newGuests - oldGuests;
                adminTitle = diff > 0 ? "Jauns spēlētājs! 🏒" : "Spēlētājs atteicās! ❌";
                actionText = diff > 0 ? `pievienoja viesi` : `noņēma viesi`;
            }

            const reachedTarget = isJoin && playerCount === 6;
            if (reachedTarget) adminTitle = "Minimums sasniegts! ✅ (6/6)";

            const playerStatusMsg = JSON.stringify({
                title: adminTitle,
                body: `${profile.full_name} ${actionText}: ${sessionInfo}. Kopā: ${playerCount}`,
                url: `/#session-${session.id}`
            });

            // 2. SEND TO ADMINS (All admins, regardless of session)
            const { data: admins } = await supabase
                .from('profiles')
                .select('id, push_subscriptions(subscription_json)')
                .eq('is_admin', true);

            admins?.forEach((admin: any) => {
                admin.push_subscriptions?.forEach((sub: any) => {
                    notifications.push(WebPush.sendNotification(sub.subscription_json, playerStatusMsg));
                });
            });

            // 3. SEND TO ALL REGISTERED USERS
            session.registrations?.forEach((reg: any) => {
                const p = reg.profiles;
                // Only send to non-admins (admins already got the admin alert)
                if (p && !p.is_admin && p.id !== profileId) {
                    p.push_subscriptions?.forEach((sub: any) => {
                        notifications.push(WebPush.sendNotification(sub.subscription_json, playerStatusMsg));
                    });
                }
            });

            // 4. PLAYER "GAME ON" NOTIFICATION (Only if count hits exactly 6)
            if (reachedTarget) {
                const playerMsg = JSON.stringify({
                    title: "Sastāvs savākts! 🏒✅",
                    body: `Minimums (6/6) sasniegts spēlei: ${sessionInfo}. Tiekamies laukumā!`,
                    url: `/#session-${session.id}`
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
    // 3. FORGOT PIN NOTIFICATION LOGIC
    else if (payload?.type === 'admin_forgot_pin') {
        try {
            const requestId = payload.request_id; // Pass this in the webhook payload

            // Fetch the details of the help request
            const { data: request, error: reqError } = await supabase
                .from('forgot_pin_requests')
                .select('*')
                .eq('id', requestId)
                .single();

            if (reqError || !request) return new Response("Request not found", { status: 404 });

            // Prepare the message for Ēvalds/Admins
            const adminMsg = JSON.stringify({
                title: "🔑 PIN Palīdzība!",
                body: `${request.full_name} (${request.phone_number}) nevar pieslēgties. Mēģinātais PIN: ${request.attempted_pin}`,
                url: `/` // Link to your admin dashboard if you have one
            });

            // Get all Admins and their subscriptions
            const { data: admins } = await supabase
                .from('profiles')
                .select('id, push_subscriptions(subscription_json)')
                .eq('is_admin', true);

            // Dispatch notifications to all admin devices
            admins?.forEach((admin: any) => {
                admin.push_subscriptions?.forEach((sub: any) => {
                    notifications.push(WebPush.sendNotification(sub.subscription_json, adminMsg));
                });
            });

        } catch (err: any) {
            console.error("Forgot PIN Notification Crash:", err);
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
                                url: `/#session-${game.id}`,
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