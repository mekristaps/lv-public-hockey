"use server";

import { createClient } from "@/lib/supabase/server";
import { isUserAdmin } from "./profiles";
import { revalidatePath } from "next/cache";

export async function getSchedule() {
    const supabase = await createClient();
    const adminStatus = await isUserAdmin();

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let profileFields = "full_name";

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
        .gte('start_time', now.toISOString())
        .order('start_time', { ascending: true });

    if (error) {
        console.error('Error fetching sessions:', error);
        return [];
    }

    return data;
}