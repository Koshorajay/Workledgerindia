"use client";
import { useEffect, useState, type FormEvent } from "react";
import {
  FileText,
  Upload,
  ExternalLink,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { Modal, Field, Badge } from "./ui";
import { References } from "./library";
import type { ComplianceTemplate } from "@/lib/compliance";
import { supabase } from "@/lib/supabase";
import {
  dateLabel,
  displayStatus,
  statuses,
  todayISO,
  type Task,
  type Profile,
  type Company,
  type History,
  type Attachment,
} from "@/lib/model";
export function TaskDetail({
  task,
  companies,
  profiles,
  templates,
  profile,
  preview,
  onClose,
  onSaved,
  onNewPeriod,
}: {
  task: Task;
  companies: Company[];
  profiles: Profile[];
  templates: ComplianceTemplate[];
  profile: Profile;
  preview: boolean;
  onClose: () => void;
  onSaved: (s: string) => void;
  onNewPeriod: (t: Task) => void;
}) {
  const admin = profile.role === "admin";
  const [draft, setDraft] = useState(task),
    [history, setHistory] = useState<History[]>([]),
    [files, setFiles] = useState<Attachment[]>([]),
    [upload, setUpload] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const fresh = !task.created_at && task.id === "new";
  const template = templates.find((t) => t.id === draft.compliance_template_id);
  useEffect(() => {
    if (preview || fresh || !supabase) return;
    let alive = true;
    (async () => {
      const [h, a] = await Promise.all([
        supabase!
          .from("task_history")
          .select("*")
          .eq("task_id", task.id)
          .order("created_at", { ascending: false }),
        supabase!
          .from("attachments")
          .select("*")
          .eq("task_id", task.id)
          .order("created_at", { ascending: false }),
      ]);
      if (alive) {
        if (h.error || a.error)
          setError(
            h.error?.message || a.error?.message || "Unable to load details",
          );
        else {
          setHistory(h.data || []);
          setFiles(a.data || []);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [task.id, fresh, preview]);
  const change = (key: keyof Task, v: unknown) =>
    setDraft((d) => ({ ...d, [key]: v }));
  async function save(e: FormEvent) {
    e.preventDefault();
    if (preview || !supabase) return;
    setBusy(true);
    setError("");
    let saved = false;
    try {
      const fields: Record<string, unknown> = {
        status: draft.status,
        completion_date:
          draft.status === "Completed" ? draft.completion_date : null,
        remarks: draft.remarks,
      };
      if (admin)
        for (const k of [
          "company_id",
          "assigned_to",
          "particular",
          "objective",
          "activity",
          "frequency",
          "category",
          "documents_required",
          "timeline_text",
          "due_date",
          "reporting_person",
          "review_required",
          "review_flags",
          "period_label",
          "template_key",
          "compliance_template_id",
          "source_pdf_name",
          "source_reference",
          "source_company",
        ] as const)
          fields[k] =
            typeof draft[k] === "string" && draft[k] === "" ? null : draft[k];
      const query = fresh
        ? supabase.from("tasks").insert(fields)
        : supabase
            .from("tasks")
            .update(fields)
            .eq("id", task.id)
            .eq("updated_at", task.updated_at);
      const { data, error: se } = await query.select().single();
      if (se)
        throw new Error(
          !fresh && se.code === "PGRST116"
            ? "This task changed since you opened it. Close and refresh the workspace before saving."
            : se.message,
        );
      saved = true;
      if (upload) {
        const allowed = [
          "pdf",
          "doc",
          "docx",
          "xls",
          "xlsx",
          "jpg",
          "jpeg",
          "png",
          "webp",
        ];
        const extension = upload.name.split(".").pop()?.toLowerCase();
        if (
          !allowed.includes(extension || "") ||
          upload.size > 10 * 1024 * 1024
        )
          throw new Error(
            "Evidence must be PDF, Word, Excel or an image, up to 10 MB.",
          );
        const path = `${data.company_id}/${data.id}/${crypto.randomUUID()}-${upload.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: ue } = await supabase.storage
          .from("evidence")
          .upload(path, upload, { upsert: false });
        if (ue) throw ue;
        const { error: ae } = await supabase
          .from("attachments")
          .insert({
            task_id: data.id,
            uploaded_by: profile.id,
            file_name: upload.name,
            storage_path: path,
            file_type: upload.type || "application/octet-stream",
          });
        if (ae) {
          await supabase.storage.from("evidence").remove([path]);
          throw ae;
        }
      }
      onSaved("Details updated.");
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unable to save";
      if (saved) {
        onSaved("Task saved, but evidence upload failed: " + msg);
        onClose();
      } else setError(msg);
    } finally {
      setBusy(false);
    }
  }
  async function openFile(f: Attachment) {
    if (!supabase) return;
    const { data, error } = await supabase.storage
      .from("evidence")
      .createSignedUrl(f.storage_path, 60);
    if (error) setError(error.message);
    else window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }
  async function removeFile(f: Attachment) {
    if (!supabase || !admin) return;
    setBusy(true);
    const { error: a } = await supabase
      .from("attachments")
      .delete()
      .eq("id", f.id);
    if (a) setError(a.message);
    else {
      const { error: s } = await supabase.storage
        .from("evidence")
        .remove([f.storage_path]);
      setFiles((fs) => fs.filter((x) => x.id !== f.id));
      if (s)
        setError(
          "File record removed; storage cleanup failed. Contact your administrator.",
        );
    }
    setBusy(false);
  }
  const updateFields = (
    <>
      {" "}
      <Field label="Status">
        <select
          value={draft.status}
          onChange={(e) => {
            change("status", e.target.value);
            if (e.target.value === "Completed" && !draft.completion_date)
              change("completion_date", todayISO());
            if (e.target.value !== "Completed") change("completion_date", null);
          }}
        >
          {statuses.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </Field>
      {draft.status === "Completed" && (
        <Field label="Completion date">
          <input
            type="date"
            required
            max={todayISO()}
            value={draft.completion_date || ""}
            onChange={(e) => change("completion_date", e.target.value)}
          />
        </Field>
      )}
      <Field label="Remarks" wide>
        <textarea
          rows={3}
          value={draft.remarks}
          onChange={(e) => change("remarks", e.target.value)}
          placeholder="Add a brief progress update…"
        />
      </Field>{" "}
    </>
  );
  return (
    <Modal title={fresh ? "Add work" : task.particular} onClose={onClose} wide>
      <form onSubmit={save}>
        <div className="detail-meta">
          <Badge status={displayStatus(task)} />
          <span>{companies.find((c) => c.id === draft.company_id)?.name}</span>
          <span>{draft.frequency}</span>
        </div>
        {preview && (
          <div className="notice">
            Read-only preview. Connect Supabase to save changes and evidence.
          </div>
        )}
        {task.review_required && (
          <div className="review-notice">
            <strong>Source needs review</strong>
            <ul>
              {task.review_flags.length ? (
                task.review_flags.map((f, i) => <li key={i}>{f}</li>)
              ) : (
                <li>
                  Confirm the period and due date before tracking this
                  responsibility.
                </li>
              )}
            </ul>
          </div>
        )}
        <div className="form-grid">
          {!admin && updateFields}
          {admin ? (
            <>
              <Field label="Company">
                <select
                  required
                  value={draft.company_id}
                  onChange={(e) => change("company_id", e.target.value)}
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.active ? "" : " (inactive)"}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Assigned person">
                <select
                  required
                  value={draft.assigned_to}
                  onChange={(e) => change("assigned_to", e.target.value)}
                >
                  {profiles
                    .filter(
                      (p) => p.role === "updater" || p.id === draft.assigned_to,
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}
                        {p.active ? "" : " (inactive)"}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Particular / responsibility" wide>
                <input
                  required
                  value={draft.particular}
                  onChange={(e) => change("particular", e.target.value)}
                />
              </Field>
            </>
          ) : (
            <Field label="Responsibility" wide>
              <p>{draft.particular}</p>
            </Field>
          )}
          {(["objective", "activity", "documents_required"] as const).map(
            (k) => (
              <Field
                key={k}
                label={
                  {
                    objective: "Objective",
                    activity: "Activity",
                    documents_required: "Documents required",
                  }[k]
                }
                wide
              >
                {admin ? (
                  <textarea
                    rows={2}
                    value={draft[k] || ""}
                    onChange={(e) => change(k, e.target.value)}
                  />
                ) : (
                  <p>{draft[k] || "Not specified in source"}</p>
                )}
              </Field>
            ),
          )}
          {admin ? (
            <>
              <Field label="Frequency">
                <input
                  required
                  value={draft.frequency}
                  onChange={(e) => change("frequency", e.target.value)}
                />
              </Field>
              <Field label="Reporting person">
                <input
                  value={draft.reporting_person || ""}
                  onChange={(e) => change("reporting_person", e.target.value)}
                />
              </Field>
              <Field label="Source timeline" wide>
                <input
                  value={draft.timeline_text || ""}
                  onChange={(e) => change("timeline_text", e.target.value)}
                />
              </Field>
              <Field label="Category">
                <input
                  value={draft.category || ""}
                  onChange={(e) => change("category", e.target.value)}
                />
              </Field>
              <Field label="Period label">
                <input
                  required
                  value={draft.period_label}
                  onChange={(e) => change("period_label", e.target.value)}
                  placeholder="e.g. October 2026"
                />
              </Field>
              <Field label="Confirmed due date">
                <input
                  type="date"
                  value={draft.due_date || ""}
                  onChange={(e) => change("due_date", e.target.value || null)}
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Timeline">
                <p>{draft.timeline_text || "Not specified"}</p>
              </Field>
              <Field label="Due date">
                <p>{dateLabel(draft.due_date)}</p>
              </Field>
              <Field label="Period">
                <p>{draft.period_label}</p>
              </Field>
              <Field label="Reporting person">
                <p>{draft.reporting_person || "Not specified"}</p>
              </Field>
            </>
          )}
          {admin && updateFields}
          {admin && (
            <label className="check-field field-wide">
              <input
                type="checkbox"
                checked={!draft.review_required}
                onChange={(e) => change("review_required", !e.target.checked)}
              />
              <span>
                I have reviewed the source wording, frequency and timeline.
              </span>
            </label>
          )}
        </div>
        <section className="detail-section">
          <h3>Evidence</h3>
          <label className="upload-zone">
            <Upload size={20} />
            <span>
              {upload ? upload.name : "Choose a file"}
              <small>PDF, Excel, Word, JPG, PNG or WebP · up to 10 MB</small>
            </span>
            <input
              type="file"
              disabled={preview}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
              onChange={(e) => setUpload(e.target.files?.[0] || null)}
            />
          </label>
          {files.map((f) => (
            <div className="file-row" key={f.id}>
              <FileText size={18} />
              <button
                type="button"
                className="text-button"
                onClick={() => void openFile(f)}
              >
                {f.file_name}
                <ExternalLink size={15} />
              </button>
              {admin && (
                <button
                  type="button"
                  className="text-button danger"
                  disabled={busy}
                  onClick={() => void removeFile(f)}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </section>
        <section className="detail-section">
          <h3>Update history</h3>
          {history.length ? (
            history.map((h) => (
              <div className="history-row" key={h.id}>
                <ShieldCheck size={17} />
                <div>
                  <strong>
                    {h.update_note} · {h.new_status}
                  </strong>
                  <p>{h.new_remarks || "No remarks"}</p>
                  <small>
                    {new Date(h.created_at).toLocaleString("en-IN")} ·{" "}
                    {profiles.find((p) => p.id === h.updated_by)?.full_name ||
                      "Administrator / import"}
                  </small>
                </div>
              </div>
            ))
          ) : (
            <p className="muted">No updates recorded yet.</p>
          )}
        </section>
        <section className="source-reference">
          <strong>Source reference</strong>
          <p>{draft.source_reference || "Manually created responsibility"}</p>
          {draft.source_company && (
            <p>Original report: {draft.source_company}</p>
          )}
        </section>
        {template && (
          <section className="detail-section">
            <h3>Compliance reference</h3>
            <p className="muted">
              {template.code} · {template.deadline_text}
            </p>
            <References items={template.official_references} />
          </section>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          {admin && !fresh && (
            <button
              type="button"
              className="button secondary"
              disabled={preview}
              onClick={() => onNewPeriod(draft)}
            >
              <Plus size={16} />
              New period
            </button>
          )}
          <button type="button" className="button secondary" onClick={onClose}>
            Close
          </button>
          <button className="button" disabled={busy || preview}>
            {busy ? "Saving…" : "Update details"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
