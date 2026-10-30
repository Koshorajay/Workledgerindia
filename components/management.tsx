"use client";
import { useState, type FormEvent } from "react";
import {
  Building2,
  Plus,
  UserRoundPlus,
  Pencil,
  ShieldCheck,
  ListChecks,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { normalizeUsername } from "@/lib/username";
import { stats, type Company, type Profile, type Task } from "@/lib/model";
import { Modal, Field, Badge } from "./ui";
export function Companies({
  companies,
  tasks,
  preview,
  onSaved,
  onSetup,
}: {
  companies: Company[];
  tasks: Task[];
  preview: boolean;
  onSaved: (s: string) => void;
  onSetup: (id: string) => void;
}) {
  const [edit, setEdit] = useState<Company | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!edit || !supabase || preview) return;
    setBusy(true);
    setError("");
    const v = {
      name: edit.name.trim(),
      code: edit.code.trim().toUpperCase(),
      active: edit.active,
    };
    const { error } = edit.id
      ? await supabase.from("companies").update(v).eq("id", edit.id)
      : await supabase.from("companies").insert(v);
    if (error) setError(error.message);
    else {
      setEdit(null);
      onSaved("Company saved.");
    }
    setBusy(false);
  }
  return (
    <>
      <div className="section-toolbar">
        <h2>Companies</h2>
        <button
          className="button"
          disabled={preview}
          onClick={() => setEdit({ id: "", name: "", code: "", active: true })}
        >
          <Plus size={17} />
          Add company
        </button>
      </div>
      <div className="company-grid">
        {companies.map((c) => {
          const s = stats(tasks.filter((t) => t.company_id === c.id));
          return (
            <section className="panel" key={c.id}>
              <div className="panel-heading">
                <span className="company-icon">
                  <Building2 />
                </span>
                <Badge status={c.active ? "Active" : "Inactive"} />
              </div>
              <h2>{c.name}</h2>
              <p className="muted">
                {c.code} · {s.total} responsibilities
              </p>
              <div className="company-stat">
                <strong>{s.percent}%</strong>
                <span>complete</span>
              </div>
              <div className="progress-track">
                <div style={{ width: s.percent + "%" }} />
              </div>
              <div className="company-card-footer">
                <span>{s.completed} completed</span>
                <span>{s.overdue} overdue</span>
              </div>
              <div className="button-row">
                <button
                  className="button secondary"
                  disabled={preview}
                  onClick={() => {
                    setEdit(c);
                    setError("");
                  }}
                >
                  <Pencil size={16} />
                  Edit company
                </button>
                <button className="button secondary" onClick={() => onSetup(c.id)}>
                  <ListChecks size={16} />
                  Compliance setup
                </button>
              </div>
            </section>
          );
        })}
      </div>
      {edit && (
        <Modal
          title={edit.id ? "Edit company" : "Add company"}
          onClose={() => setEdit(null)}
        >
          <form onSubmit={save}>
            <div className="form-grid">
              <Field label="Company name" wide>
                <input
                  required
                  value={edit.name}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                />
              </Field>
              <Field label="Company code">
                <input
                  required
                  value={edit.code}
                  onChange={(e) => setEdit({ ...edit, code: e.target.value })}
                />
              </Field>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={edit.active}
                  onChange={(e) =>
                    setEdit({ ...edit, active: e.target.checked })
                  }
                />
                Active company
              </label>
            </div>
            {error && <p className="error">{error}</p>}
            <div className="modal-actions">
              <button className="button" disabled={busy}>
                Save company
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
export function People({
  profiles,
  tasks,
  profile,
  preview,
  onSaved,
}: {
  profiles: Profile[];
  tasks: Task[];
  profile: Profile;
  preview: boolean;
  onSaved: (s: string) => void;
}) {
  const [edit, setEdit] = useState<Profile | null>(null),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!edit || !supabase || preview) return;
    setBusy(true);
    setError("");
    try {
      if (edit.id) {
        const { error } = await supabase
          .from("profiles")
          .update({
            full_name: edit.full_name,
            display_name: edit.display_name,
            role: edit.role,
            active: edit.active,
          })
          .eq("id", edit.id);
        if (error) throw error;
        if (password) {
          const { data, error: resetError } = await supabase.functions.invoke(
            "manage-users",
            {
              body: { action: "reset-password", profile_id: edit.id, password },
            },
          );
          if (resetError || data?.error)
            throw new Error(
              "Account details saved, but password reset failed: " +
                (data?.error || resetError?.message || "Try again."),
            );
        }
      } else {
        const { data, error } = await supabase.functions.invoke(
          "manage-users",
          {
            body: {
              username: normalizeUsername(edit.username),
              password,
              full_name: edit.full_name,
              role: edit.role,
            },
          },
        );
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      }
      setEdit(null);
      setPassword("");
      onSaved("Account saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Account update failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="section-toolbar">
        <h2>People</h2>
        <button
          className="button"
          disabled={preview}
          onClick={() => {
            setEdit({
              id: "",
              auth_user_id: "",
              username: "",
              full_name: "",
              display_name: "",
              role: "updater",
              active: true,
            });
            setPassword("");
            setError("");
          }}
        >
          <UserRoundPlus size={17} />
          Add account
        </button>
      </div>
      <div className="people-grid">
        {profiles.map((p, i) => {
          const s = stats(tasks.filter((t) => t.assigned_to === p.id));
          return (
            <section className="panel" key={p.id}>
              <div className="panel-heading">
                <span className={"avatar tone-" + (i % 3)}>
                  {p.full_name.slice(0, 2).toUpperCase()}
                </span>
                <Badge status={p.active ? "Active" : "Inactive"} />
              </div>
              <h2>{p.full_name}</h2>
              <p className="muted">
                @{p.username} ·{" "}
                {p.role === "admin" ? "Administrator" : "Updater"}
              </p>
              <div className="mini-stats">
                <div>
                  <strong>{s.total}</strong>
                  <span>Assigned</span>
                </div>
                <div>
                  <strong>{s.completed}</strong>
                  <span>Completed</span>
                </div>
                <div>
                  <strong>{s.overdue}</strong>
                  <span>Overdue</span>
                </div>
              </div>
              <p className="muted">
                {s.pending} pending · {s.progress} in progress · {s.percent}%
                complete
              </p>
              <div className="progress-track">
                <div style={{ width: s.percent + "%" }} />
              </div>
              <button
                className="button secondary"
                disabled={preview}
                onClick={() => {
                  setEdit(p);
                  setPassword("");
                  setError("");
                }}
              >
                <Pencil size={16} />
                Edit account
              </button>
            </section>
          );
        })}
      </div>
      {edit && (
        <Modal
          title={edit.id ? "Edit account" : "Create account"}
          onClose={() => {
            setEdit(null);
            setPassword("");
          }}
        >
          <form onSubmit={save}>
            <div className="form-grid">
              <Field label="Full name" wide>
                <input
                  required
                  value={edit.full_name}
                  onChange={(e) =>
                    setEdit({ ...edit, full_name: e.target.value })
                  }
                />
              </Field>
              <Field label="Username" wide>
                <input
                  required
                  disabled={!!edit.id}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  pattern="[a-zA-Z][a-zA-Z0-9_]{1,31}"
                  minLength={2}
                  maxLength={32}
                  value={edit.username}
                  onChange={(e) =>
                    setEdit({ ...edit, username: e.target.value })
                  }
                />
              </Field>
              <Field
                label={
                  edit.id
                    ? "New password (optional, 12+ characters)"
                    : "Initial password (12+ characters)"
                }
                wide
              >
                <input
                  type="password"
                  required={!edit.id}
                  minLength={12}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <Field label="Role">
                <select
                  disabled={edit.id === profile.id}
                  value={edit.role}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      role: e.target.value as "admin" | "updater",
                    })
                  }
                >
                  <option value="updater">Updater</option>
                  <option value="admin">Admin</option>
                </select>
              </Field>
              <label className="check-field">
                <input
                  type="checkbox"
                  disabled={edit.id === profile.id}
                  checked={edit.active}
                  onChange={(e) =>
                    setEdit({ ...edit, active: e.target.checked })
                  }
                />
                Account active
              </label>
            </div>
            <p className="muted">
              Leave password blank to keep it.
            </p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button className="button" disabled={busy}>
                {busy ? "Saving…" : "Save account"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
export function SettingsPanel({ preview }: { preview: boolean }) {
  return (
    <section className="panel setup-panel">
      <ShieldCheck size={30} />
      <h2>
        {preview ? "Connect your workspace" : "Your workspace is connected"}
      </h2>
      <p className="muted">
        {preview
          ? "The source preview is read-only. Complete the included SUPABASE_SETUP.txt guide to enable accounts, saved updates and private evidence."
          : "Permissions are enforced by the database. Updaters can update only their own work."}
      </p>
      {preview && (
        <ol>
          <li>Create a Supabase project and run the supplied SQL migration.</li>
          <li>Create the administrator and three updater accounts.</li>
          <li>
            Add the project URL and public key to the app environment, then
            rebuild.
          </li>
          <li>
            Open Import & review to confirm and import the responsibilities.
          </li>
        </ol>
      )}
      {!preview && (
        <p>
          Manage usernames and reset staff passwords from People. Staff members
          can change their own password from Profile.
        </p>
      )}
      <h3>Periods & deadlines</h3>
      <p>
        Source frequency and timeline text stay unchanged. An administrator sets
        the period and confirmed due date. Use “New period” on a task to create
        its next occurrence while keeping the completed record.
      </p>
      <h3>Evidence & reports</h3>
      <p>
        Files are private and limited to 10 MB. Authorized users receive
        short-lived download links. CSV exports reflect your current filters;
        use your browser’s print command for a PDF report.
      </p>
      <a
        className="button secondary"
        href={preview ? "/login/" : "/login/?change=1"}
      >
        {preview ? "Open sign-in page" : "Change your password"}
      </a>
    </section>
  );
}
