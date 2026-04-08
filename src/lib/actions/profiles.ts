"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

export interface UserProfile {
    created_at: string;
    id: string;
    phone_number: string;
    pin_code: string;
    full_name: string;
    is_admin: boolean;
    registrations: any[];
}

export async function profileActionOLD(prevFormState: any, formData: FormData) {
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

// actions
export async function profileAction(prevFormState: any, formData: FormData) {
    
    const mode = formData.get('mode');
    const fullName = formData.get("full_name")?.toString().trim() || "";
    const phone = formData.get("phone")?.toString().replace(/\s/g, "") || "";
    const pin = formData.get('pin_code')?.toString() || "";

    const oldPhone = formData.get('old_phone')?.toString().replace(/\s/g, "") || "";
    const oldPin = formData.get('old_pin')?.toString() || "";

    // 1. Phone Validation: Only digits, 8-12 characters
    const phoneRegex = /^\d{8,12}$/;
    if (!phoneRegex.test(phone)) {
        return { ...prevFormState, error: "Nederīgs telefona numurs! Jābūt 8-12 cipariem (bez burtiem)." };
    }

    // Login
    if (mode === 'login') {
        // 3. PIN Validation: Exactly 4 digits
        const pinRegex = /^\d{4}$/;
        if (!pinRegex.test(pin)) {
            return { ...prevFormState, error: "PIN kodam jābūt tieši 4 cipariem!" };
        }

        if (!phone || !pin) {
            return { ...prevFormState, error: "Lūdzu aizpildiet visus laukus" };
        }

        return loginProfile(formData);
    }

    // Update
    if (mode === 'edit') {
        // 3. PIN Validation: Exactly 4 digits

        if (oldPin !== pin) {
            const pinRegex = /^\d{4}$/;
            if (!pinRegex.test(pin)) {
                return { ...prevFormState, error: "PIN kodam jābūt tieši 4 cipariem!" };
            }
        }
        

        if (!phone || !fullName) {
            return { ...prevFormState, error: "Lūdzu aizpildiet visus laukus" };
        }

        return loginProfile(formData);
    }

    // Register
    if (mode === 'register') {
        const nameRegex = /^[A-ZĀČĒĢĪĶĻŅŠŪŽa-zāčēģīķļņšūž\s-]+$/;
        if (!nameRegex.test(fullName) || fullName.length < 3) {
            return { ...prevFormState, error: "Nederīgs vārds! Izmantojiet tikai burtus (vismaz 3)." };
        }

        if (!phone || !fullName) {
            return { ...prevFormState, error: "Lūdzu aizpildiet visus laukus" };
        }

        return registerProfile(formData);
    }
}

async function registerProfile(formData: FormData) {
    const supabase = await createClient();
    
    const fullName = formData.get('full_name')?.toString().trim() || "";
    const phone = formData.get('phone')?.toString().replace(/\s/g, "") || "";

    // Inside profileAction
    const generatedPin = Math.floor(1000 + Math.random() * 9000).toString();

    const { error } = await supabase
        .from('profiles')
        .upsert({ 
            phone_number: phone, 
            full_name: fullName, 
            pin_code: generatedPin 
        });

    if (!error) {
        revalidatePath("/");
        return { 
            success: true, 
            generatedPin: generatedPin, 
            phone: phone,
            isReset: true
        };
    }

    return { 
        success: false,
        error: error.message || "Failed to register new user",
        errorType: 'general'
    };
}

async function loginProfile(formData: FormData) {
    const supabase = await createClient();
    const phone = formData.get('phone')?.toString().replace(/\s/g, "") || "";
    const pin = formData.get('pin_code')?.toString() || "";

    const { data: userExists } = await supabase
        .from("profiles")
        .select("phone_number, full_name")
        .eq("phone_number", phone)
        .single();

    if (!userExists) {
        return { 
            success: false, 
            error: "Lietotājs ar šādu numuru nav atrasts. Lūdzu, reģistrējieties!",
            errorType: 'user_not_found'
        };
    }

    const { data: existingProfile, error: pinError } = await supabase
        .from("profiles")
        .select("*")
        .eq("phone_number", phone)
        .eq("pin_code", pin)
        .single();

    if (pinError) {
        return { 
            success: false,
            error: "Nepareizs PIN kods šim numuram!",
            errorType: 'wrong_pin',
            failedAttempt: {
                phone: phone,
                name: userExists.full_name
            }
        };
    }

    // set for 30 days
    const cookieStore = await cookies();
    cookieStore.set("hokejs_user_id", existingProfile.id, { maxAge: 60 * 60 * 24 * 30 });

    revalidatePath("/");
    return { success: true, data: existingProfile };
}

async function updateProfile(formData: FormData) {
    const supabase = await createClient();
    const phone = formData.get('phone')?.toString().replace(/\s/g, "") || "";
    const oldPhone = formData.get('old_phone')?.toString().replace(/\s/g, "") || "";
    const pin = formData.get('pin_code')?.toString() || "";
    const oldPin = formData.get('old_pin')?.toString() || "";

    const { data: userExists } = await supabase
        .from("profiles")
        .select("phone_number, full_name")
        .eq("phone_number", phone)
        .eq("pin_code", oldPin)
        .single();
    
    if (!userExists) {
        return { 
            success: false, 
            error: "Lietotājs ar šādu numuru nav atrasts. Lūdzu, reģistrējieties!",
            errorType: 'user_not_found'
        };
    }

    const { data: newUserData, error: pinError } = await supabase
        .from("profiles")
        .update({
            phone_number: phone,
            pin_code: pin
        })
        .eq("phone_number", oldPhone)
        .eq("pin_code", oldPin);
    
        if (pinError) {
        return { 
            success: false,
            error: "Nepareizs PIN kods šim numuram!",
            errorType: 'wrong_pin',
            failedAttempt: {
                phone: phone,
                name: userExists.full_name
            }
        };
    }

    revalidatePath("/");
    return { success: true, updatedProfile: newUserData };
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
        return { success: false, error: error };
    }
    
    return { success: true };
}

export async function getUserProfile(id: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('profiles')
        .select(`
            *,
            registrations (
                session_id,
                guests_count
            )
        `)
        .eq('id', id)
        .single();

    if (error) {
        if (error.code !== 'PGRST116') { // Ignore "No rows found" logs
            console.error('Error fetching user profile:', error);
        }
        return null;
    }

    return data;
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