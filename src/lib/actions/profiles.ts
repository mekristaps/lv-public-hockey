"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function profileAction(prevFormState: any, formData: FormData) {
	const supabase = await createClient();

	const fullName = formData.get("full_name");
	const phone = formData.get("phone");

	if (!phone || !fullName) {
		return { ...prevFormState, error: "Lūdzu aizpildiet visus laukus" };
	}

	// Upsert: If phone_number exists, update full_name. If not, insert.
	const { data, error } = await supabase
		.from("profiles")
		.upsert(
			{ phone_number: phone, full_name: fullName },
			{ onConflict: "phone_number" },
		)
		.select()
		.single();

	if (error) {
		console.error("Database Error:", error);
		return { ...prevFormState, error: "Kļūda saglabājot profilu" };
	}

	revalidatePath("/");
	return {
		...prevFormState,
		success: true,
		message: "Profils saglabāts",
		user: { phone: data.phone_number, name: data.full_name },
	};
}

export async function registerAction(profileId: string, sessionId: string) {
    const supabase = await createClient();

    // 1. Check if user is already in THIS exact session (To Unregister)
    const { data: existingSame } = await supabase
        .from("registrations")
        .select("id")
        .eq("session_id", sessionId)
        .eq("profile_id", profileId)
        .maybeSingle();

    if (existingSame) {
        await supabase.from("registrations").delete().eq("id", existingSame.id);
        revalidatePath("/");
        return { success: true, message: "Pieteikums atcelts!" };
    }

    // 2. Get the time of the session the user WANTS to join
    const { data: targetSession } = await supabase
        .from("sessions")
        .select("start_time")
        .eq("id", sessionId)
        .single();

    if (!targetSession) return { success: false, message: "Sesija nav atrasta." };

    // 3. Define the 2-hour conflict window
    const targetDate = new Date(targetSession.start_time);
    const minTime = new Date(targetDate.getTime() - 119 * 60000).toISOString();
    const maxTime = new Date(targetDate.getTime() + 119 * 60000).toISOString();

    // 4. Find ANY registration where the session time overlaps
    // We select 'session_id' and filter by the joined 'sessions' table time
    const { data: conflicts } = await supabase
        .from("registrations")
        .select(`
            id,
            sessions!inner (
                start_time
            )
        `)
        .eq("profile_id", profileId)
        .gt("sessions.start_time", minTime)
        .lt("sessions.start_time", maxTime);

    // 5. If conflicts exist, delete them first to allow the new "Switch"
    if (conflicts && conflicts.length > 0) {
        const conflictIds = conflicts.map(c => c.id);
        await supabase.from("registrations").delete().in("id", conflictIds);
    }

    // 6. Insert the new one
    const { error: insertError } = await supabase.from("registrations").insert({
        session_id: sessionId,
        profile_id: profileId,
    });

    if (insertError) {
        console.error("Insert Error:", insertError);
        return { success: false, message: "Neizdevās pieteikties." };
    }

    revalidatePath("/");
    return { 
        success: true, 
        message: conflicts && conflicts.length > 0 ? "Laiks veiksmīgi pārcelts!" : "Veiksmīgi pieteicies!" 
    };
}