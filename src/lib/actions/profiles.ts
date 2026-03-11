"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function profileAction(prevFormState: any, formData: FormData) {
    const supabase = await createClient();

    // Convert to strings early to avoid TypeScript 'File' errors
    const fullName = formData.get("full_name")?.toString().trim() || "";
    const phone = formData.get("phone")?.toString().replace(/\s/g, "") || "";
    const newPin = formData.get('pin_code')?.toString() || "";
    const sessionPin = formData.get('current_session_pin')?.toString() || "";

    // 1. Phone Validation: Only digits, 8-12 characters
    const phoneRegex = /^\d{8,12}$/;
    if (!phoneRegex.test(phone)) {
        return { ...prevFormState, error: "Nederīgs telefona numurs! Jābūt 8-12 cipariem (bez burtiem)." };
    }

    // 2. Name Validation: No numbers allowed, support Latvian chars
    const nameRegex = /^[A-ZĀČĒĢĪĶĻŅŠŪŽa-zāčēģīķļņšūž\s-]+$/;
    if (!nameRegex.test(fullName) || fullName.length < 3) {
        return { ...prevFormState, error: "Nederīgs vārds! Izmantojiet tikai burtus (vismaz 3)." };
    }

    // 3. PIN Validation: Exactly 4 digits
    const pinRegex = /^\d{4}$/;
    if (!pinRegex.test(newPin)) {
        return { ...prevFormState, error: "PIN kodam jābūt tieši 4 cipariem!" };
    }

    if (!phone || !fullName || !newPin) {
        return { ...prevFormState, error: "Lūdzu aizpildiet visus laukus" };
    }

    // 1. Check if the profile already exists
    const { data: existingProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("phone_number", phone)
        .single();
    
    if (existingProfile) {
        // AUTH LOGIC: 
        // 1. If the user provided a 'sessionPin' (they are logged in), verify it.
        // 2. If they are NOT logged in (new device), verify the 'newPin' they just typed matches the DB.
        const pinToVerify = sessionPin || newPin;

        if (existingProfile.pin_code && existingProfile.pin_code !== pinToVerify) {
            return { 
                ...prevFormState, 
                error: "Nepareizs PIN kods šim numuram!",
                failedAttempt: {
                    phone: phone,
                    name: fullName,
                    pin: newPin
                }
            };
        }

        // 3. Update existing profile (Update name or PIN if they want to change it)
        // Now it's safe to update to the new values
        const { data: updatedData, error: updateError } = await supabase
            .from("profiles")
            .update({ 
                full_name: fullName, 
                pin_code: newPin // This updates the PIN to the one they typed
            })
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
        .insert({ phone_number: phone, full_name: fullName, pin_code: newPin })
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

export async function requestPinHelpAction(phone: string, name: string, pin: string) {
    const supabase = await createClient();

    // 1. Insert the request and select the result to get the ID
    const { data, error } = await supabase
        .from('forgot_pin_requests')
        .insert({
            phone_number: phone,
            full_name: name,
            attempted_pin: pin
        })
        .select('id')
        .single();

    if (error || !data) {
        console.error("DB Error:", error);
        return { success: false };
    }
    
    return { success: true };
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