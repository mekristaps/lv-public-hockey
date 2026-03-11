"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function profileAction(prevFormState: any, formData: FormData) {
    const supabase = await createClient();

    const fullName = formData.get("full_name");
    const phone = formData.get("phone");
    const pinCode = formData.get('pin_code');

    if (!phone || !fullName || !pinCode) {
        return { ...prevFormState, error: "Lūdzu aizpildiet visus laukus" };
    }

    // 1. Check if the profile already exists
    const { data: existingProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("phone_number", phone)
        .single();
    
    if (existingProfile) {
        // 2. Security Check: Verify PIN matches
        // If the user is already logged in (updating name), or if they are logging in from new device
        if (existingProfile.pin_code && existingProfile.pin_code !== pinCode) {
            return { ...prevFormState, error: "Nepareizs PIN kods šim numuram!" };
        }

        // 3. Update existing profile (Update name or PIN if they want to change it)
        const { data: updatedData, error: updateError } = await supabase
            .from("profiles")
            .update({ full_name: fullName, pin_code: pinCode })
            .eq("phone_number", phone)
            .select()
            .single();
        
        if (updateError) {
            return { ...prevFormState, error: "Kļūda atjaunojot profilu" };
        }

        revalidatePath("/");
        return {
            ...prevFormState,
            success: true,
            message: "Profils atjaunots",
            user: updatedData,
        };
    }

    // 4. Create new profile if it doesn't exist
    const { data: newData, error: insertError } = await supabase
        .from("profiles")
        .insert({ phone_number: phone, full_name: fullName, pin_code: pinCode })
        .select()
        .single();
    
    if (insertError) {
        console.error("Database Error:", insertError);
        return { ...prevFormState, error: "Kļūda izveidojot profilu" };
    }

    revalidatePath("/");
    return {
        ...prevFormState,
        success: true,
        message: "Profils izveidots",
        user: newData,
    };
}

// session registering
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
        return { success: false, message: `Neizdevās pieteikties. ${insertError}` };
    }

    revalidatePath("/");
    return {
        success: true,
        message: conflicts && conflicts.length > 0 ? "Laiks veiksmīgi pārcelts!" : "Veiksmīgi pieteicies!"
    };
}

export async function updateGuestsAction(profileId: string, sessionId: string, validatedCount: number) {
    const supabase = await createClient();

    const { error } = await supabase
        .from('registrations')
        .update({ guests_count: validatedCount })
        .eq('session_id', sessionId)
        .eq('profile_id', profileId);

    if (error) {
        console.error("Update Error:", error);
        return { success: false, message: "Neizdevās atjaunināt viesu skaitu" };
    }

    revalidatePath("/");
    return {
        success: true,
        message: "Veiksmīgi atjaunināts viesu skaits!"
    };
}