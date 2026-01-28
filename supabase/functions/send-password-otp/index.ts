import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check if user exists
    const { data: userData } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = userData?.users?.some(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!userExists) {
      // Don't reveal if user exists - just say OTP sent
      return new Response(
        JSON.stringify({ success: true, message: "If the email exists, an OTP has been sent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any existing OTPs for this email
    await supabaseAdmin
      .from("password_reset_otps")
      .delete()
      .eq("email", email.toLowerCase());

    // Store the new OTP
    const { error: insertError } = await supabaseAdmin
      .from("password_reset_otps")
      .insert({
        email: email.toLowerCase(),
        otp_code: otpCode,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("Error storing OTP:", insertError);
      throw new Error("Failed to generate OTP");
    }

    console.log(`OTP generated for ${email}, expires at ${expiresAt.toISOString()}`);

    // Send OTP email using Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      throw new Error("Email service not configured");
    }

    const resend = new Resend(resendApiKey);

    const { error: emailError } = await resend.emails.send({
      from: "Ramadan Data <onboarding@resend.dev>",
      to: [email],
      subject: "Password Reset Code - Ramadan Data",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; padding: 40px 20px; margin: 0;">
          <div style="max-width: 400px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h1 style="color: #18181b; font-size: 24px; font-weight: 600; text-align: center; margin: 0 0 8px 0;">Password Reset</h1>
            <p style="color: #71717a; font-size: 14px; text-align: center; margin: 0 0 32px 0;">Ramadan Data App</p>
            
            <p style="color: #3f3f46; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
              You requested to reset your password. Use the code below to complete the process:
            </p>
            
            <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; text-align: center; margin: 0 0 24px 0;">
              <span style="font-family: 'Courier New', monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #18181b;">${otpCode}</span>
            </div>
            
            <p style="color: #71717a; font-size: 12px; text-align: center; margin: 0 0 8px 0;">
              This code expires in <strong>10 minutes</strong>.
            </p>
            
            <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin: 24px 0 0 0;">
              If you didn't request this, you can safely ignore this email.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (emailError) {
      console.error("Error sending email via Resend:", emailError);
      throw new Error("Failed to send reset code email");
    }

    console.log(`OTP email sent successfully to ${email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Password reset code sent to your email. Check your inbox."
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in send-password-otp:", error);
    const message = error instanceof Error ? error.message : "Failed to send OTP";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
