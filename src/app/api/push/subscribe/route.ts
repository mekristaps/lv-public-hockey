import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {

    try {
        const supabase = await createClient();
        const { subscription, phoneNumber } = await request.json();
        
        // validation
        if (!subscription || !subscription.endpoint || !phoneNumber) {
            return NextResponse.json({ error: "Missing data" }, { status: 400 });
        }

        // verify profile exists in your custom table
        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("id")
            .eq("phone_number", phoneNumber)
            .single();

        if (profileError || !profile) {
            return NextResponse.json({ error: "Profile not found" }, { status: 404 });
        }

        const profileId = profile.id;
        
        // store subscription tied to your profile ID
        const { error } = await supabase
            .from("push_subscriptions")
            .upsert({
                profile_id: profileId,
                subscription_json: subscription,
                endpoint: subscription.endpoint,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'endpoint' });

        if (error) {
            throw error;
        }
        return NextResponse.json({ success: true });

    } catch(error: any) {
        console.error("Push subscription error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}