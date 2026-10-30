"use client";
import { useEffect, useState, type FormEvent } from "react";
import { supabase, configured } from "@/lib/supabase";
import { loginAddress } from "@/lib/username";
export default function Auth({ onSuccess }: { onSuccess?: () => void }) {
  const [mode, setMode] = useState<"login" | "forgot" | "reset">("login"),
    [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [currentPassword, setCurrentPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("reset");
    });
    if (
      location.hash.includes("type=recovery") ||
      new URLSearchParams(location.search).get("change") === "1"
    )
      setMode("reset");
    return () => data.subscription.unsubscribe();
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "forgot") {
        setMessage("Ask your administrator to reset your password.");
      } else if (mode === "reset") {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user?.email)
          throw new Error("Sign in before changing your password.");
        const { error: currentError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });
        if (currentError) throw new Error("Current password is incorrect.");
        const { error } = await supabase.auth.updateUser({
          password,
          current_password: currentPassword,
        });
        if (error) throw error;
        setMessage("Password updated. You can now sign in.");
        setPassword("");
        setCurrentPassword("");
        setMode("login");
        await supabase.auth.signOut();
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: loginAddress(username),
          password,
        });
        if (error) throw new Error("Username or password is incorrect.");
        const { data: p, error: pe } = await supabase
          .from("profiles")
          .select("role,active")
          .eq("auth_user_id", data.user.id)
          .single();
        if (pe || !p?.active) {
          await supabase.auth.signOut();
          throw new Error(
            "Your account needs an active profile. Please contact your administrator.",
          );
        }
        if (onSuccess) onSuccess();
        else location.assign(p.role === "admin" ? "/admin/" : "/updater/");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-form-wrap">
        <form className="auth-form" onSubmit={submit}>
          <h2>
            {mode === "login"
              ? "Sign in"
              : mode === "forgot"
                ? "Need help signing in?"
                : "Choose a new password"}
          </h2>
          {!configured && (
            <div className="notice">Sign-in is not configured.</div>
          )}
          {mode === "login" && (
            <label className="field">
              <span>Username</span>
              <input
                required
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Your username"
              />
            </label>
          )}
          {mode === "reset" && (
            <label className="field">
              <span>Current password</span>
              <input
                required
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </label>
          )}
          {mode !== "forgot" && (
            <label className="field">
              <span>{mode === "reset" ? "New password" : "Password"}</span>
              <input
                required
                type="password"
                autoComplete={
                  mode === "reset" ? "new-password" : "current-password"
                }
                minLength={mode === "reset" ? 12 : 1}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="success" role="status">
              {message}
            </p>
          )}
          {mode !== "forgot" && (
            <button className="button" disabled={busy || !configured}>
              {busy
                ? "Please wait…"
                : mode === "login"
                  ? "Sign in"
                  : "Update password"}
            </button>
          )}
          {mode === "login" ? (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setMode("forgot");
                setMessage("Ask your administrator to reset your password.");
                setPassword("");
                setCurrentPassword("");
                setError("");
              }}
            >
              Forgot password?
            </button>
          ) : (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setMode("login");
                setPassword("");
                setCurrentPassword("");
                setError("");
                setMessage("");
              }}
            >
              Back to sign in
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
