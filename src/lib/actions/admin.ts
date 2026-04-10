'use server'

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

import { isUserAdmin } from "./profiles";

export async function getPinRequests() {
    const isAdmin = await isUserAdmin();

    if (!isAdmin) return null;

    const supabase = await createClient();

    const { data, error } = await supabase
        .from('forgot_pin_requests')
        .select('id, full_name, created_at, phone_number')
        .eq('status', 'pending');

    if (error) {
        return { success: false, error: error };
    }

    return { success: true, data: data };
}

export async function sendNewPin(requestID: string) {
    // 1. Security Check: Only admins can trigger this
    const isAdmin = await isUserAdmin();
    if (!isAdmin) return { success: false, error: 'Unauthorized' };

    const supabase = await createClient();

    // 2. Get the request data
    const { data: request, error: fetchError } = await supabase
        .from('forgot_pin_requests')
        .select('phone_number, resend_link')
        .eq('id', requestID)
        .maybeSingle();

    if (fetchError || !request) {
        return { success: false, error: 'Pieprasījums netika atrasts.' };
    }

    // 3. Find the profile and update it
    // Using .select() after update lets us check if a row was actually affected
    const { data: updatedProfile, error: profileError } = await supabase
        .from('profiles')
        .update({
            old_pin: null,
            pin_change_requested: false
        })
        .eq('phone_number', request.phone_number)
        .select('id')
        .maybeSingle();

    if (profileError) return { success: false, error: 'Kļūda atjauninot profilu.' };
    
    // 4. Check if a profile with that phone number actually existed
    if (!updatedProfile) {
        return { success: false, error: 'Lietotāja profils ar šādu numuru neeksistē.' };
    }

    // 5. Finally, update the request status to 'sent'
    const { error: statusError } = await supabase
        .from('forgot_pin_requests')
        .update({ status: 'sent' })
        .eq('id', requestID);

    if (statusError) return { success: false, error: 'Kļūda statusa atjaunināšanā.' };

    revalidatePath('/');
    return { success: true, link: request.resend_link };
}