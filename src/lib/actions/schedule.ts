"use server";

import { createClient } from "@/lib/supabase/server";
import { isUserAdmin } from "./profiles";
import { revalidatePath } from "next/cache";

export async function getSchedule() {
    const supabase = await createClient();
    const adminStatus = await isUserAdmin();

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    // This creates "2026-04-13T00:00:00.000Z" exactly
    const startOfToday = `${year}-${month}-${day}T00:00:00.000Z`;

    let profileFields = "full_name";
    profileFields += ", id";

    if (adminStatus) {
        profileFields += ", phone_number";
    }

    const { data, error } = await supabase
        .from('sessions')
        .select(`
            *,
            registrations (
                id,
                profiles (
                    ${profileFields}
                ),
                guests_count
            )
        `)
        .gte('start_time', startOfToday)
        .order('start_time', { ascending: true });

    if (error) {
        console.error('Error fetching sessions:', error);
        return [];
    }

    revalidatePath('/');
    return data;
}