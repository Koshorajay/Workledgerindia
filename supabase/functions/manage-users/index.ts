import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.3";
// Deploy in Supabase Edge Functions; these keys are never part of the Next.js build.
Deno.serve(async (request: Request) => {
  const allowedOrigin = Deno.env.get("APP_ORIGIN") || "";
  const origin = request.headers.get("Origin") || "";
  const cors = {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  if (!allowedOrigin || origin !== allowedOrigin)
    return reply(403, { error: "Origin is not allowed." });
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return reply(405, { error: "Use POST." });
  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Bearer "))
    return reply(401, { error: "Sign in first." });
  const url = Deno.env.get("SUPABASE_URL")!;
  const service = createClient(
    url,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const {
    data: { user },
    error: authError,
  } = await service.auth.getUser(header.slice(7));
  if (authError || !user) return reply(401, { error: "Invalid session." });
  const { data: profile } = await service
    .from("profiles")
    .select("id,role,active")
    .eq("auth_user_id", user.id)
    .single();
  if (!profile?.active || profile.role !== "admin")
    return reply(403, { error: "Administrator access required." });
  try {
    const data = await request.json();
    const username = String(data.username || "")
      .trim()
      .toLowerCase();
    const email = `${username}@workledger.invalid`;
    const password = String(data.password || "");
    if (data.action === "reset-password") {
      if (password.length < 12 || password.length > 256)
        return reply(400, {
          error: "Password must contain 12–256 characters.",
        });
      const { data: target } = await service
        .from("profiles")
        .select("id,auth_user_id")
        .eq("id", String(data.profile_id || ""))
        .single();
      if (!target) return reply(404, { error: "Account not found." });
      const { error: resetError } = await service.auth.admin.updateUserById(
        target.auth_user_id,
        { password },
      );
      if (resetError)
        return reply(400, { error: "Unable to reset this password." });
      const { error: auditError } = await service
        .from("audit_logs")
        .insert({
          actor_id: profile.id,
          action: "password_reset",
          entity_type: "profiles",
          entity_id: target.id,
          metadata: {},
        });
      if (auditError)
        return reply(500, {
          error:
            "Password changed, but the audit record could not be saved. Contact support.",
        });
      return reply(200, { success: true });
    }
    const full_name = String(data.full_name || "").trim();
    const role = String(data.role || "updater");
    if (
      !/^[a-z][a-z0-9_]{1,31}$/.test(username) ||
      password.length < 12 ||
      password.length > 256 ||
      !full_name ||
      full_name.length > 120 ||
      !["admin", "updater"].includes(role)
    )
      return reply(400, {
        error:
          "A valid username, name, role and password of at least 12 characters are required.",
      });
    const { data: created, error } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) return reply(400, { error: error.message });
    // Use the caller's JWT to make the profile insert subject to admin RLS and attribute its audit log.
    const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: header } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: p, error: pe } = await caller
      .from("profiles")
      .insert({
        auth_user_id: created.user.id,
        username,
        full_name,
        display_name: full_name,
        role,
        active: true,
      })
      .select("id,username,full_name,role")
      .single();
    if (pe) {
      await service.auth.admin.deleteUser(created.user.id);
      return reply(400, { error: pe.message });
    }
    return reply(201, { profile: p });
  } catch {
    return reply(400, {
      error:
        "Unable to create account. Check the request and Supabase function logs.",
    });
  }
});
