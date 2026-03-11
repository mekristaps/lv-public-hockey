import { SupabaseClient } from "@supabase/supabase-js";


export async function getUser(supabase: SupabaseClient, companyId: string) {
    const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('company_id', companyId)
        .single();

    if (error) {
        console.error('Error fetching company settings:', error);
        return null;
    }

    return data;
}

export async function getUserProfile(supabase: SupabaseClient, phoneNumber: string) {
    const { data, error } = await supabase
        .from('profiles')
        .select(`
            *,
            registrations (
                session_id,
                guests_count
            )
        `)
        .eq('phone_number', phoneNumber)
        .single();

    if (error) {
        if (error.code !== 'PGRST116') { // Ignore "No rows found" logs
            console.error('Error fetching user profile:', error);
        }
        return null;
    }

    return data;
}

export async function getSchedule(supabase: SupabaseClient) {
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