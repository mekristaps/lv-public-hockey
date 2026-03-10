// supabase/functions/push-reminders/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import WebPush from "https://esm.sh/web-push"

serve(async (req) => {
  // 1. Security Check: Only allow requests with our Service Role Key
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // 2. Setup WebPush with your keys
  WebPush.setVapidDetails(
    'mailto:your-email@example.com',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!
  );

  // 3. Find games starting in 60-90 minutes
  const now = new Date();
  const sixtyMins = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  const ninetyMins = new Date(now.getTime() + 90 * 60 * 1000).toISOString();

  const { data: games, error } = await supabase
    .from('games')
    .select(`
      id, 
      arena_name, 
      start_time,
      game_registrations (
        profile_id,
        profiles (
          push_subscriptions ( subscription_json )
        )
      )
    `)
    .gt('start_time', sixtyMins)
    .lt('start_time', ninetyMins);

  // 4. Loop and Send!
  // (Logic to send notifications to each subscription_json found)
  
  return new Response(JSON.stringify({ message: "Sent" }), { 
    headers: { "Content-Type": "application/json" } 
  });
})