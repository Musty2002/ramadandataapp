import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, device_info, user_id } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if this token already exists
    const { data: existing } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, user_id")
      .eq("endpoint", token)
      .single();

    if (existing) {
      // Update existing subscription (possibly linking to user if they logged in)
      const updateData: Record<string, unknown> = {
        device_info,
        updated_at: new Date().toISOString(),
      };
      
      // Only update user_id if provided and not already set
      if (user_id && !existing.user_id) {
        updateData.user_id = user_id;
      }

      const { error } = await supabaseAdmin
        .from("push_subscriptions")
        .update(updateData)
        .eq("id", existing.id);

      if (error) throw error;

      console.log("Updated push subscription:", existing.id);
      return new Response(
        JSON.stringify({ success: true, action: "updated", id: existing.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Insert new subscription
      const { data, error } = await supabaseAdmin
        .from("push_subscriptions")
        .insert({
          endpoint: token,
          device_info,
          user_id: user_id || null,
        })
        .select("id")
        .single();

      if (error) throw error;

      console.log("Created new push subscription:", data.id);
      return new Response(
        JSON.stringify({ success: true, action: "created", id: data.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: unknown) {
    console.error("Error registering push token:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
