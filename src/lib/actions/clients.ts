'use server'

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createClientAction(prevFormState: any, formData: FormData) {
    const supabase = await createClient(); // Use the server-side client

    const { error } = await supabase
        .from('clients')
        .insert({
            company_id: formData.get("company_id") as string,
            type: formData.get("client_type") as string,
            name: formData.get("name") as string,
            email: formData.get("email") as string,
            phone: formData.get("phone") as string,
            address: formData.get("address") as string,
            reg_number: formData.get("reg_id") as string,
            vat_number: formData.get("vat_nr") as string,
        });

    if (error) {
        return { ...prevFormState, error: error.message };
    }

    revalidatePath('/clients'); // Refresh the cache for the clients list
    return { success: true, message: "Client created successfully" };
}