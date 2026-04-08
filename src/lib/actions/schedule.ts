"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getSchedule() {
    const supabase = await createClient();
    
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
        .from('sessions')
        .select(`
            *,
            registrations (
                id,
                profiles (
                    full_name,
                    phone_number
                ),
                guests_count
            )
        `)
        .gte('start_time', now.toISOString())
        .order('start_time', { ascending: true });

    if (error) {
        console.error('Error fetching sessions:', error);
        return [];
    }

    return data;
}