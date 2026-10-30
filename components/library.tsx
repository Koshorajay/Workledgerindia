"use client";
import { useState, type FormEvent } from "react";
import {
  Plus,
  Search,
  SlidersHorizontal,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Archive,
  Undo2,
  Pencil,
  CalendarDays,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { dateLabel, type Profile } from "@/lib/model";
import {
  areas,
  byArea,
  conditionsApplicability,
  describeApplicability,
  describeRule,
  draftPayload,
  factGroups,
  isSafeUrl,
  reviewStatuses,
  ruleTypes,
  templateDraft,
  templateFrequencies,
  type ComplianceTemplate,
  type Condition,
  type Reference,
  type ReviewStatus,
  type RuleType,
  type TemplateDraft,
} from "@/lib/compliance";
import { Modal, Field, Badge, Empty } from "./ui";
type Filters = { search: string; area: string; frequency: string; status: string };
const emptyFilters: Filters = { search: "", area: "all", frequency: "all", status: "all" };
export function filterTemplates(templates: ComplianceTemplate[], f: Filters) {
  const q = f.search.trim().toLowerCase();
  return templates
    .filter(
      (t) =>
        (!q ||
          [t.code, t.title, t.form_name, t.description, t.deadline_text]
            .join(" ")
            .toLowerCase()
            .includes(q)) &&
        (f.area === "all" || t.area === f.area) &&
        (f.frequency === "all" || t.frequency === f.frequency) &&
        (f.status === "all" || t.review_status === f.status),
    )
    .sort(byArea);
}
const savedError = (e: { code?: string; message: string }) =>
  e.code === "PGRST116"
    ? "This template changed since you opened it. Close it and open it again."
    : e.code === "23505"
      ? "Another template already uses this code."
      : e.message;
export default function Library({
  templates,
  profiles,
  preview,
  onSaved,
}: {
  templates: ComplianceTemplate[];
  profiles: Profile[];
  preview: boolean;
  onSaved: (s: string) => void;
}) {
  const [filters, setFilters] = useState(emptyFilters),
    [expanded, setExpanded] = useState(false),
    [page, setPage] = useState(0),
    [open, setOpen] = useState(""),
    [edit, setEdit] = useState<TemplateDraft | null>(null);
  const list = filterTemplates(templates, filters);
  const totalPages = Math.max(1, Math.ceil(list.length / 12));
  const current = Math.min(page, totalPages - 1);
  const rows = list.slice(current * 12, current * 12 + 12);
  const opened = templates.find((t) => t.id === open);
  const count = (s: ReviewStatus) => templates.filter((t) => t.review_status === s).length;
  const change = (k: keyof Filters, v: string) => {
    setPage(0);
    setFilters({ ...filters, [k]: v });
  };
  return (
    <>
      <section className="panel report-summary">
        <div>
          <h2>Template library</h2>
          <p className="muted">
            {templates.length} templates · {count("Reviewed")} reviewed ·{" "}
            {count("Needs review")} need review
            {count("Retired") ? ` · ${count("Retired")} retired` : ""}
          </p>
        </div>
        <div className="button-row">
          <button
            className="button"
            disabled={preview}
            onClick={() => setEdit(templateDraft())}
          >
            <Plus size={17} />
            Add template
          </button>
        </div>
      </section>
      <p className="muted section-copy">
        Starter templates were checked against official sources on 24 Oct 2026.
        They stay “Needs review” until an administrator confirms them, and only
        reviewed templates can be activated for a company.
      </p>
      <div className="work-filter-panel">
        <div className="search-row">
          <label className="search-box">
            <Search size={19} />
            <input
              aria-label="Search templates"
              placeholder="Search forms and activities…"
              value={filters.search}
              onChange={(e) => change("search", e.target.value)}
            />
          </label>
          <button
            className="button secondary filter-toggle"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            <SlidersHorizontal size={17} />
            Filters
          </button>
        </div>
        <div className={"filters " + (expanded ? "expanded" : "")}>
          <label>
            Area
            <select value={filters.area} onChange={(e) => change("area", e.target.value)}>
              <option value="all">All areas</option>
              {areas.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label>
            Frequency
            <select
              value={filters.frequency}
              onChange={(e) => change("frequency", e.target.value)}
            >
              <option value="all">All frequencies</option>
              {templateFrequencies.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <label>
            Review
            <select value={filters.status} onChange={(e) => change("status", e.target.value)}>
              <option value="all">All statuses</option>
              {reviewStatuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <button
            className="text-button"
            onClick={() => {
              setFilters(emptyFilters);
              setPage(0);
            }}
          >
            Clear
          </button>
        </div>
      </div>
      <div className="results-label">
        <span>{list.length} templates</span>
        <span>
          {current * 12 + 1 > list.length ? 0 : current * 12 + 1}–
          {Math.min((current + 1) * 12, list.length)} of {list.length}
        </span>
      </div>
      {list.length ? (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Template</th>
                  <th>Area</th>
                  <th>Frequency</th>
                  <th>Deadline</th>
                  <th>Review</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <button className="task-name" onClick={() => setOpen(t.id)}>
                        {t.title}
                      </button>
                      <small>
                        {t.code}
                        {t.form_name ? ` · ${t.form_name}` : ""}
                      </small>
                    </td>
                    <td>{t.area}</td>
                    <td>{t.frequency}</td>
                    <td>
                      <small className="deadline-cell">{t.deadline_text}</small>
                    </td>
                    <td>
                      <Badge status={t.review_status} />
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={"Open " + t.title}
                        onClick={() => setOpen(t.id)}
                      >
                        <ChevronRight size={19} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="task-cards">
            {rows.map((t) => (
              <button className="task-card" key={t.id} onClick={() => setOpen(t.id)}>
                <div className="task-card-top">
                  <span>{t.area}</span>
                  <Badge status={t.review_status} />
                </div>
                <h3>{t.title}</h3>
                <p>{t.description}</p>
                <div className="task-card-meta">
                  <span>{t.frequency}</span>
                  <span>{t.code}</span>
                </div>
                <div className="task-card-bottom">
                  <span>
                    <CalendarDays size={16} />
                    {t.deadline_text}
                  </span>
                  <ChevronRight size={18} />
                </div>
              </button>
            ))}
          </div>
          <div className="pagination">
            <button
              className="button secondary"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              Previous
            </button>
            <span>
              Page {current + 1} of {totalPages}
            </span>
            <button
              className="button secondary"
              disabled={current >= totalPages - 1}
              onClick={() => setPage(current + 1)}
            >
              Next
            </button>
          </div>
        </>
      ) : (
        <section className="panel">
          <Empty title="No templates match these filters" body="Change filters." />
        </section>
      )}
      {opened && (
        <TemplateDetail
          key={opened.id + opened.updated_at}
          template={opened}
          profiles={profiles}
          preview={preview}
          onClose={() => setOpen("")}
          onEdit={() => {
            setEdit(templateDraft(opened));
            setOpen("");
          }}
          onSaved={onSaved}
        />
      )}
      {edit && (
        <TemplateForm
          draft={edit}
          setDraft={setEdit}
          preview={preview}
          onClose={() => setEdit(null)}
          onSaved={onSaved}
        />
      )}
    </>
  );
}
export function References({ items }: { items: Reference[] }) {
  return (
    <ul className="reference-list">
      {items.map((r, i) => (
        <li key={i}>
          {isSafeUrl(r.url) ? (
            <a href={r.url} target="_blank" rel="noopener noreferrer">
              {r.label}
              <ExternalLink size={14} />
            </a>
          ) : (
            <span>{r.label}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
export function TemplateDetail({
  template: t,
  profiles,
  preview,
  onClose,
  onEdit,
  onSaved,
}: {
  template: ComplianceTemplate;
  profiles: Profile[];
  preview: boolean;
  onClose: () => void;
  onEdit?: () => void;
  onSaved: (s: string) => void;
}) {
  const [notes, setNotes] = useState(t.review_notes),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const reviewer = profiles.find((p) => p.id === t.reviewed_by)?.full_name;
  async function setStatus(review_status: ReviewStatus) {
    if (!supabase || preview) return;
    setBusy(true);
    setError("");
    const { error } = await supabase
      .from("compliance_templates")
      .update({ review_status, review_notes: notes.trim() })
      .eq("id", t.id)
      .eq("updated_at", t.updated_at)
      .select("id")
      .single();
    setBusy(false);
    if (error) setError(savedError(error));
    else {
      onSaved(
        review_status === "Retired"
          ? "Template retired."
          : review_status === "Needs review"
            ? "Template marked as needing review."
            : t.review_status === "Reviewed"
              ? "Review notes saved."
              : "Template marked as reviewed.",
      );
      onClose();
    }
  }
  return (
    <Modal title={t.title} onClose={onClose} wide>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void setStatus("Reviewed");
        }}
      >
        <div className="detail-meta">
          <Badge status={t.review_status} />
          <span>{t.area}</span>
          <span>{t.frequency}</span>
          <span>{t.code}</span>
        </div>
        {preview && (
          <div className="notice">
            Read-only preview. Connect Supabase to review or edit templates.
          </div>
        )}
        <p className="template-description">{t.description}</p>
        <div className="form-grid">
          <Field label="Form">
            <p>{t.form_name || "No form"}</p>
          </Field>
          <Field label="Deadline">
            <p>{t.deadline_text}</p>
          </Field>
          <Field label="Objective" wide>
            <p>{t.objective || "Not specified"}</p>
          </Field>
          <Field label="Activity" wide>
            <p>{t.activity || "Not specified"}</p>
          </Field>
        </div>
        <section className="detail-section">
          <h3>Deadline rule</h3>
          <ul className="plain-list">
            {describeRule(t.deadline_rule).map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </section>
        <section className="detail-section">
          <h3>Required documents</h3>
          <ul className="plain-list">
            {t.required_documents.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </section>
        <section className="detail-section">
          <h3>Official references</h3>
          <References items={t.official_references} />
        </section>
        <section className="detail-section">
          <h3>When it is suggested</h3>
          <p className="muted">{describeApplicability(t.applicability)}</p>
        </section>
        <section className="detail-section">
          <h3>Review</h3>
          <p className="muted">
            {t.review_status === "Reviewed"
              ? `Reviewed by ${reviewer || "an administrator"} on ${dateLabel(t.reviewed_at)}.`
              : t.review_status === "Retired"
                ? "Retired: no longer suggested or available for new checklists."
                : "Not yet reviewed by an administrator."}
            {t.last_verified_on
              ? ` Last checked against official sources on ${dateLabel(t.last_verified_on)}.`
              : ""}
          </p>
          <Field label="Review notes" wide>
            <textarea
              rows={3}
              value={notes}
              disabled={preview}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
          {t.review_status === "Needs review" && (
            <label className="check-field">
              <input
                type="checkbox"
                checked={confirmed}
                disabled={preview}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>
                I have checked the description, deadline rule, documents and
                references against the official sources.
              </span>
            </label>
          )}
        </section>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          {t.review_status === "Retired" ? (
            <button
              type="button"
              className="button secondary"
              disabled={busy || preview}
              onClick={() => void setStatus("Needs review")}
            >
              <Undo2 size={16} />
              Restore
            </button>
          ) : (
            <button
              type="button"
              className="button secondary"
              disabled={busy || preview}
              onClick={() => void setStatus("Retired")}
            >
              <Archive size={16} />
              Retire
            </button>
          )}
          {t.review_status === "Reviewed" && (
            <button
              type="button"
              className="button secondary"
              disabled={busy || preview}
              onClick={() => void setStatus("Needs review")}
            >
              Needs review
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              className="button secondary"
              disabled={preview}
              onClick={onEdit}
            >
              <Pencil size={16} />
              Edit
            </button>
          )}
          {t.review_status !== "Retired" && (
            <button
              className="button"
              disabled={busy || preview || (t.review_status === "Needs review" && !confirmed)}
            >
              <ShieldCheck size={16} />
              {busy
                ? "Saving…"
                : t.review_status === "Reviewed"
                  ? "Save notes"
                  : "Mark as reviewed"}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
function TemplateForm({
  draft: d,
  setDraft,
  preview,
  onClose,
  onSaved,
}: {
  draft: TemplateDraft;
  setDraft: (d: TemplateDraft) => void;
  preview: boolean;
  onClose: () => void;
  onSaved: (s: string) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const set = <K extends keyof TemplateDraft>(k: K, v: TemplateDraft[K]) =>
    setDraft({ ...d, [k]: v });
  const fixedDays = d.type === "agm" || d.type === "incorporation";
  const kept = [
    d.keep.only_periods && "selected months only",
    d.keep.overrides?.length && "different dates for some periods",
    d.keep.when?.length && "a different date for some answers",
    d.keep.cycle && `repeats every ${d.keep.cycle.every_years} years`,
  ].filter(Boolean);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!supabase || preview) return;
    const r = draftPayload(d);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setBusy(true);
    setError("");
    const { code, ...fields } = r.value;
    const { error } = d.id
      ? await supabase
          .from("compliance_templates")
          .update(fields)
          .eq("id", d.id)
          .eq("updated_at", d.updated_at)
          .select("id")
          .single()
      : await supabase
          .from("compliance_templates")
          .insert({ code, ...fields })
          .select("id")
          .single();
    setBusy(false);
    if (error) setError(savedError(error));
    else {
      onSaved(d.id ? "Template saved." : "Template added.");
      onClose();
    }
  }
  return (
    <Modal title={d.id ? "Edit template" : "Add template"} onClose={onClose} wide>
      <form onSubmit={save}>
        <div className="form-grid">
          <Field label="Code">
            <input
              required
              disabled={!!d.id}
              autoCapitalize="characters"
              spellCheck={false}
              value={d.code}
              placeholder="GST-EXAMPLE"
              onChange={(e) => set("code", e.target.value.toUpperCase())}
            />
          </Field>
          <Field label="Area">
            <select
              value={d.area}
              onChange={(e) => set("area", e.target.value as TemplateDraft["area"])}
            >
              {areas.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </Field>
          <Field label="Title" wide>
            <input required value={d.title} onChange={(e) => set("title", e.target.value)} />
          </Field>
          <Field label="Form">
            <input value={d.form_name} onChange={(e) => set("form_name", e.target.value)} />
          </Field>
          <Field label="Deadline in words">
            <input
              required
              value={d.deadline_text}
              placeholder="e.g. 11th of the following month"
              onChange={(e) => set("deadline_text", e.target.value)}
            />
          </Field>
          <Field label="Description" wide>
            <textarea
              rows={3}
              value={d.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>
          <Field label="Objective" wide>
            <textarea
              rows={2}
              value={d.objective}
              onChange={(e) => set("objective", e.target.value)}
            />
          </Field>
          <Field label="Activity" wide>
            <textarea
              rows={2}
              value={d.activity}
              onChange={(e) => set("activity", e.target.value)}
            />
          </Field>
        </div>
        <section className="detail-section">
          <h3>Deadline rule</h3>
          <div className="form-grid">
            <Field label="Schedule">
              <select value={d.type} onChange={(e) => set("type", e.target.value as RuleType)}>
                {ruleTypes.map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            {d.type !== "monthly" && d.type !== "incorporation" && (
              <Field label="Year">
                <select
                  value={d.basis}
                  onChange={(e) => set("basis", e.target.value as TemplateDraft["basis"])}
                >
                  <option value="tax_fy">April–March year</option>
                  <option value="company_fy">Company&apos;s financial year</option>
                  <option value="calendar">Calendar year</option>
                </select>
              </Field>
            )}
            {d.type === "event" ? (
              <Field label="When it falls due" wide>
                <input
                  value={d.event_text}
                  placeholder="e.g. Within 30 days of the change"
                  onChange={(e) => set("event_text", e.target.value)}
                />
              </Field>
            ) : fixedDays ? (
              <Field label={d.type === "agm" ? "Days after the AGM" : "Days after incorporation"}>
                <input
                  type="number"
                  min={0}
                  max={730}
                  required
                  value={d.days_after}
                  onChange={(e) => set("days_after", e.target.value)}
                />
              </Field>
            ) : (
              <>
                <Field label="Due">
                  <select
                    value={d.mode}
                    onChange={(e) => set("mode", e.target.value as TemplateDraft["mode"])}
                  >
                    <option value="month_day">On a day of a later month</option>
                    <option value="days">A number of days after the period</option>
                  </select>
                </Field>
                {d.mode === "days" ? (
                  <Field label="Days after the period ends">
                    <input
                      type="number"
                      min={0}
                      max={730}
                      required
                      value={d.days_after}
                      onChange={(e) => set("days_after", e.target.value)}
                    />
                  </Field>
                ) : (
                  <>
                    <Field label="Months after the period">
                      <input
                        type="number"
                        min={0}
                        max={24}
                        required
                        value={d.months_after}
                        onChange={(e) => set("months_after", e.target.value)}
                      />
                    </Field>
                    <Field label="Day (31 = last day)">
                      <input
                        type="number"
                        min={1}
                        max={31}
                        required
                        value={d.day}
                        onChange={(e) => set("day", e.target.value)}
                      />
                    </Field>
                  </>
                )}
              </>
            )}
            {d.type !== "event" && d.type !== "incorporation" && (
              <Field label="Notified extensions (period | YYYY-MM-DD | reference, one per line)" wide>
                <textarea
                  rows={2}
                  value={d.extensions}
                  placeholder="FY 2025-26 | 2026-11-21 | CBDT Circular No. 7/2026"
                  onChange={(e) => set("extensions", e.target.value)}
                />
              </Field>
            )}
          </div>
          {kept.length > 0 && (
            <p className="muted">
              {d.type === d.original_type
                ? `Special cases kept from the current rule: ${kept.join(", ")}.`
                : "Special cases from the current rule are dropped because the schedule changed."}
            </p>
          )}
        </section>
        <section className="detail-section">
          <h3>Documents and references</h3>
          <div className="form-grid">
            <Field label="Required documents (one per line)" wide>
              <textarea
                rows={4}
                value={d.documents}
                onChange={(e) => set("documents", e.target.value)}
              />
            </Field>
            <Field label="Official references (label | https link, one per line)" wide>
              <textarea
                rows={4}
                value={d.references}
                placeholder="CGST Act, 2017, section 37 | https://www.gst.gov.in/"
                onChange={(e) => set("references", e.target.value)}
              />
            </Field>
          </div>
        </section>
        <section className="detail-section">
          <h3>When to suggest it</h3>
          <p className="muted">{describeApplicability(conditionsApplicability(d.conditions))}</p>
          <details className="condition-picker">
            <summary>Edit questionnaire conditions</summary>
            {factGroups.map((g) => (
              <fieldset key={g.title}>
                <legend>{g.title}</legend>
                {g.facts.map(([k, label]) => (
                  <label className="condition-row" key={k}>
                    <span>{label}</span>
                    <select
                      value={d.conditions[k] || ""}
                      onChange={(e) => {
                        const c = { ...d.conditions };
                        if (e.target.value) c[k] = e.target.value as Condition;
                        else delete c[k];
                        set("conditions", c);
                      }}
                    >
                      <option value="">Not used</option>
                      <option value="all">Required</option>
                      <option value="any">Any of these</option>
                      <option value="none">Exclude</option>
                    </select>
                  </label>
                ))}
              </fieldset>
            ))}
          </details>
        </section>
        <section className="detail-section">
          <h3>Review</h3>
          <Field label="Review notes" wide>
            <textarea
              rows={2}
              value={d.review_notes}
              onChange={(e) => set("review_notes", e.target.value)}
            />
          </Field>
          <label className="check-field">
            <input
              type="checkbox"
              checked={d.confirmed}
              onChange={(e) => set("confirmed", e.target.checked)}
            />
            <span>
              I have checked this template against its official references.
              Saving marks it as reviewed.
            </span>
          </label>
          {!d.confirmed && (
            <p className="muted">
              {d.retired
                ? "The template stays retired."
                : "Without this confirmation it is saved as “Needs review”."}
            </p>
          )}
        </section>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button" disabled={busy || preview}>
            {busy ? "Saving…" : "Save template"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
