"use client";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  ChevronRight,
  ListChecks,
  Plus,
  Search,
  TriangleAlert,
  UsersRound,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { todayISO, type Company, type Profile, type Task } from "@/lib/model";
import {
  areas,
  byArea,
  checklistRows,
  entityTypes,
  normalizeAnswers,
  occurrences,
  sameAnswers,
  suggestTemplates,
  templateKey,
  templateTask,
  windowFor,
  type Answers,
  type ChecklistItem,
  type ChecklistRow,
  type CompanyProfile,
  type ComplianceTemplate,
  type WindowPreset,
} from "@/lib/compliance";
import Questionnaire from "./questionnaire";
import { TemplateDetail } from "./library";
import { Badge, Empty, Field, Modal } from "./ui";
type Step = "questionnaire" | "review" | "apply";
type Decision = { include: boolean; note: string };
type Props = {
  templates: ComplianceTemplate[];
  companyProfiles: CompanyProfile[];
  checklist: ChecklistItem[];
  tasks: Task[];
  profiles: Profile[];
  preview: boolean;
  onSaved: (s: string) => void;
};
const entityLabel = (v: string) => entityTypes.find(([k]) => k === v)?.[1] ?? "Type not set";
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
export default function Checklists({
  company,
  setCompany,
  companies,
  ...props
}: Props & {
  company: string;
  setCompany: (id: string) => void;
  companies: Company[];
}) {
  const c = companies.find((x) => x.id === company);
  if (c)
    return (
      <CompanySetup
        key={c.id}
        company={c}
        saved={props.companyProfiles.find((p) => p.company_id === c.id)}
        items={props.checklist.filter((i) => i.company_id === c.id)}
        onBack={() => setCompany("all")}
        {...props}
      />
    );
  return (
    <>
      <p className="muted section-copy">
        Choose a company to answer its setup questionnaire, review the suggested
        checklist and create its responsibilities.
      </p>
      <div className="company-grid">
        {companies.map((co) => {
          const saved = props.companyProfiles.find((p) => p.company_id === co.id);
          const items = props.checklist.filter((i) => i.company_id === co.id);
          const pending = saved
            ? suggestTemplates(props.templates, normalizeAnswers(saved.answers)).filter(
                (s) => !items.some((i) => i.template_id === s.template.id),
              ).length
            : 0;
          const status = !saved ? "Not started" : !items.length || pending ? "Needs review" : "Active";
          return (
            <section className="panel setup-card" key={co.id}>
              <div className="panel-heading">
                <span className="company-icon">
                  <Building2 />
                </span>
                <Badge status={status} />
              </div>
              <h2>{co.name}</h2>
              <p className="muted">
                {saved
                  ? entityLabel(normalizeAnswers(saved.answers).entity_type)
                  : "Questionnaire not started"}
              </p>
              <div className="mini-stats">
                <div>
                  <strong>{items.filter((i) => i.status === "Active").length}</strong>
                  <span>Active items</span>
                </div>
                <div>
                  <strong>{pending}</strong>
                  <span>To review</span>
                </div>
                <div>
                  <strong>
                    {props.tasks.filter((t) => t.company_id === co.id && t.compliance_template_id).length}
                  </strong>
                  <span>Created</span>
                </div>
              </div>
              <button className="button secondary" onClick={() => setCompany(co.id)}>
                {saved ? "Open setup" : "Start setup"}
                <ChevronRight size={16} />
              </button>
            </section>
          );
        })}
      </div>
    </>
  );
}
function CompanySetup({
  company,
  saved,
  items,
  templates,
  tasks,
  profiles,
  preview,
  onSaved,
  onBack,
}: Omit<Props, "companyProfiles" | "checklist"> & {
  company: Company;
  saved?: CompanyProfile;
  items: ChecklistItem[];
  onBack: () => void;
}) {
  const savedAnswers = normalizeAnswers(saved?.answers);
  const [answers, setAnswers] = useState(savedAnswers),
    [step, setStep] = useState<Step>(
      !saved ? "questionnaire" : items.some((i) => i.status === "Active") ? "apply" : "review",
    ),
    [decisions, setDecisions] = useState<Record<string, Decision>>({}),
    [added, setAdded] = useState<string[]>([]),
    [open, setOpen] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const dirty = !sameAnswers(answers, savedAnswers);
  const rows = checklistRows(templates, answers, items, added);
  const decision = (r: ChecklistRow): Decision =>
    decisions[r.template.id] ?? {
      include: r.item ? r.item.status === "Active" : true,
      note: r.item?.note ?? "",
    };
  const opened = templates.find((t) => t.id === open);
  const go = (s: Step) => {
    setError("");
    setStep(s);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  async function saveAnswers() {
    if (!supabase || preview) return;
    setBusy(true);
    setError("");
    const { error } = saved
      ? await supabase
          .from("company_profiles")
          .update({ answers, questionnaire_version: 1 })
          .eq("id", saved.id)
          .eq("updated_at", saved.updated_at)
          .select("id")
          .single()
      : await supabase
          .from("company_profiles")
          .insert({ company_id: company.id, answers, questionnaire_version: 1 })
          .select("id")
          .single();
    setBusy(false);
    if (error)
      setError(
        error.code === "PGRST116"
          ? "This questionnaire changed since you opened it. Refresh the workspace and try again."
          : error.message,
      );
    else onSaved("Questionnaire saved.");
  }
  async function activate() {
    if (!supabase || preview) return;
    setBusy(true);
    setError("");
    const { error } = await supabase.rpc("activate_compliance_checklist", {
      p_company_id: company.id,
      p_items: rows.map((r) => ({
        template_id: r.template.id,
        status: decision(r).include ? "Active" : "Excluded",
        origin: r.origin,
        reasons: r.reasons,
        note: decision(r).note.trim(),
      })),
    });
    setBusy(false);
    if (error) setError(error.message);
    else {
      onSaved(
        `Checklist activated with ${plural(rows.filter((r) => decision(r).include).length, "item", "items")}.`,
      );
      go("apply");
    }
  }
  // The preview applies the items included on the review step; a connected workspace uses the saved checklist.
  const applyItems = preview
    ? rows.filter((r) => decision(r).include).map((r) => ({ template: r.template }))
    : items
        .filter((i) => i.status === "Active")
        .flatMap((i) => {
          const template = templates.find((t) => t.id === i.template_id);
          return template ? [{ template, item: i }] : [];
        });
  const steps: [Step, string][] = [
    ["questionnaire", "Questionnaire"],
    ["review", "Review checklist"],
    ["apply", "Apply & assign"],
  ];
  return (
    <>
      <div className="setup-header">
        <button className="text-button" onClick={onBack}>
          <ArrowLeft size={16} />
          All companies
        </button>
      </div>
      <div className="setup-steps" role="tablist" aria-label="Setup steps">
        {steps.map(([key, label], i) => (
          <button
            key={key}
            role="tab"
            aria-selected={step === key}
            className={"step-tab" + (step === key ? " active" : "")}
            onClick={() => go(key)}
          >
            <span className="step-number">{i + 1}</span>
            {label}
          </button>
        ))}
      </div>
      {step === "questionnaire" && (
        <Questionnaire
          answers={answers}
          onChange={setAnswers}
          saved={saved}
          profiles={profiles}
          dirty={dirty}
          preview={preview}
          busy={busy}
          error={error}
          onSave={() => void saveAnswers()}
          onNext={() => go("review")}
        />
      )}
      {step === "review" && (
        <ChecklistReview
          company={company}
          rows={rows}
          decision={decision}
          setDecision={(id, d) => setDecisions((ds) => ({ ...ds, [id]: d }))}
          available={templates.filter(
            (t) => t.review_status !== "Retired" && !rows.some((r) => r.template.id === t.id),
          )}
          onAdd={(id) => setAdded((a) => [...a, id])}
          onOpen={setOpen}
          ready={!!saved && !dirty}
          preview={preview}
          busy={busy}
          error={error}
          onActivate={() => void activate()}
          onBack={() => go("questionnaire")}
          onNext={() => go("apply")}
        />
      )}
      {step === "apply" && (
        <ApplyChecklist
          company={company}
          answers={preview ? answers : savedAnswers}
          items={applyItems}
          tasks={tasks}
          profiles={profiles}
          preview={preview}
          onSaved={onSaved}
          onBack={() => go("review")}
        />
      )}
      {opened && (
        <TemplateDetail
          key={opened.id + opened.updated_at}
          template={opened}
          profiles={profiles}
          preview={preview}
          onClose={() => setOpen("")}
          onSaved={onSaved}
        />
      )}
    </>
  );
}
function ChecklistReview({
  company,
  rows,
  decision,
  setDecision,
  available,
  onAdd,
  onOpen,
  ready,
  preview,
  busy,
  error,
  onActivate,
  onBack,
  onNext,
}: {
  company: Company;
  rows: ChecklistRow[];
  decision: (r: ChecklistRow) => Decision;
  setDecision: (id: string, d: Decision) => void;
  available: ComplianceTemplate[];
  onAdd: (id: string) => void;
  onOpen: (id: string) => void;
  ready: boolean;
  preview: boolean;
  busy: boolean;
  error: string;
  onActivate: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false),
    [picker, setPicker] = useState(false);
  const included = rows.filter((r) => decision(r).include);
  const unreviewed = included.filter((r) => r.template.review_status !== "Reviewed");
  const blockers = [
    !ready && "Save the questionnaire before activating.",
    !included.length && "Include at least one item.",
    unreviewed.length > 0 &&
      `${plural(unreviewed.length, "included template needs", "included templates need")} review in the library. Open each one to review it.`,
  ].filter((b): b is string => !!b);
  return (
    <>
      <section className="panel report-summary">
        <div>
          <h2>Review checklist</h2>
          <p className="muted">
            {included.length} included · {rows.length - included.length} excluded ·{" "}
            {plural(unreviewed.length, "template needs", "templates need")} review
          </p>
        </div>
        <div className="button-row">
          <button className="button secondary" onClick={() => setPicker(true)}>
            <Plus size={16} />
            Add template
          </button>
        </div>
      </section>
      {!rows.length && (
        <section className="panel">
          <Empty
            title="No suggestions yet"
            body="Answer the questionnaire, or add templates from the library."
          />
        </section>
      )}
      {areas.map((area) => {
        const group = rows.filter((r) => r.template.area === area);
        if (!group.length) return null;
        return (
          <section className="panel checklist-group" key={area}>
            <div className="panel-heading">
              <h2>{area}</h2>
              <span className="muted">
                {group.filter((r) => decision(r).include).length} of {group.length} included
              </span>
            </div>
            {group.map((r) => {
              const d = decision(r);
              return (
                <div className={"checklist-row" + (d.include ? "" : " excluded")} key={r.template.id}>
                  <input
                    type="checkbox"
                    aria-label={"Include " + r.template.title}
                    checked={d.include}
                    onChange={(e) => setDecision(r.template.id, { ...d, include: e.target.checked })}
                  />
                  <div className="checklist-main">
                    <div className="checklist-title">
                      <button className="task-name" onClick={() => onOpen(r.template.id)}>
                        {r.template.title}
                      </button>
                      <Badge status={r.item ? r.item.status : r.origin === "Added manually" ? "Added" : "New"} />
                      {r.template.review_status !== "Reviewed" && (
                        <Badge status={r.template.review_status} />
                      )}
                    </div>
                    <small>
                      {r.template.frequency} · {r.template.deadline_text}
                    </small>
                    {r.reasons.length > 0 && (
                      <small className="reason-line">Why: {r.reasons.join(" · ")}</small>
                    )}
                    {r.item && !r.suggested && r.origin === "Suggested" && (
                      <span className="review-label">
                        <TriangleAlert size={14} />
                        No longer matches the questionnaire answers
                      </span>
                    )}
                    {d.include && r.template.review_status !== "Reviewed" && (
                      <span className="review-label">
                        <TriangleAlert size={14} />
                        Review this template before activation
                      </span>
                    )}
                    {!d.include && (
                      <input
                        className="exclude-note"
                        aria-label={"Reason for excluding " + r.template.title}
                        placeholder="Reason for excluding (optional)"
                        value={d.note}
                        onChange={(e) => setDecision(r.template.id, { ...d, note: e.target.value })}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
      <section className="panel">
        {preview ? (
          <p className="notice">
            Preview: activation is not saved. Continue to see the responsibilities
            these items would create.
          </p>
        ) : (
          blockers.length > 0 && (
            <ul className="review-flags">
              {blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )
        )}
        {!preview && (
          <label className="check-field">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>
              I have reviewed which items apply to {company.name}. Excluded items
              will not be scheduled.
            </span>
          </label>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="button-row step-actions">
          <button className="button secondary" onClick={onBack}>
            <ArrowLeft size={16} />
            Questionnaire
          </button>
          {preview ? (
            <button className="button" disabled={!included.length} onClick={onNext}>
              Continue to apply
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              className="button"
              disabled={busy || !confirmed || blockers.length > 0}
              onClick={onActivate}
            >
              <ListChecks size={16} />
              {busy ? "Activating…" : `Activate ${plural(included.length, "item", "items")}`}
            </button>
          )}
        </div>
      </section>
      {picker && (
        <TemplatePicker templates={available} onAdd={onAdd} onClose={() => setPicker(false)} />
      )}
    </>
  );
}
function TemplatePicker({
  templates,
  onAdd,
  onClose,
}: {
  templates: ComplianceTemplate[];
  onAdd: (id: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const list = templates
    .filter((t) =>
      `${t.code} ${t.title} ${t.form_name ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()),
    )
    .sort(byArea);
  return (
    <Modal title="Add a template" onClose={onClose} wide>
      <div className="modal-body">
        <label className="search-box">
          <Search size={18} />
          <input
            aria-label="Search templates"
            placeholder="Search templates…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <div className="picker-list">
          {list.map((t) => (
            <div className="picker-row" key={t.id}>
              <div>
                <strong>{t.title}</strong>
                <small>
                  {t.area} · {t.frequency} · {t.review_status}
                </small>
              </div>
              <button className="button secondary" onClick={() => onAdd(t.id)}>
                <Plus size={16} />
                Add
              </button>
            </div>
          ))}
          {!list.length && (
            <Empty
              title="No templates to add"
              body="Every matching template is already on this checklist."
            />
          )}
        </div>
      </div>
    </Modal>
  );
}
type ApplyItem = { template: ComplianceTemplate; item?: ChecklistItem };
type Edit = { selected?: boolean; due?: string; assignee?: string };
const monthIndex = (iso: string) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7));
function ApplyChecklist({
  company,
  answers,
  items,
  tasks,
  profiles,
  preview,
  onSaved,
  onBack,
}: {
  company: Company;
  answers: Answers;
  items: ApplyItem[];
  tasks: Task[];
  profiles: Profile[];
  preview: boolean;
  onSaved: (s: string) => void;
  onBack: () => void;
}) {
  const today = todayISO();
  const [preset, setPreset] = useState<WindowPreset>("quarter"),
    [range, setRange] = useState(() => windowFor("quarter", today)),
    [chosen, setChosen] = useState<Record<string, boolean>>({}),
    [edits, setEdits] = useState<Record<string, Edit>>({}),
    [bulk, setBulk] = useState(""),
    [reporting, setReporting] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const updaters = profiles.filter((p) => p.role === "updater" && p.active);
  const invalid =
    !range.from || !range.to || range.from > range.to || monthIndex(range.to) - monthIndex(range.from) >= 24;
  const isChosen = (x: ApplyItem) => chosen[x.template.id] ?? x.template.frequency !== "Event-based";
  const rows = (invalid ? [] : items.filter(isChosen))
    .flatMap((x) =>
      occurrences(x.template, answers, range.from, range.to).map((o) => {
        const key = `${x.template.code}|${o.period_label}`;
        const exists = tasks.some(
          (t) =>
            t.company_id === company.id &&
            t.template_key === templateKey(x.template) &&
            t.period_label === o.period_label,
        );
        const blocked = !preview && x.template.review_status !== "Reviewed";
        const e = edits[key] ?? {};
        const fallback =
          x.item?.default_assignee && updaters.some((p) => p.id === x.item?.default_assignee)
            ? x.item.default_assignee
            : "";
        return {
          key,
          x,
          o,
          exists,
          blocked,
          selected: !exists && !blocked && (e.selected ?? true),
          due: e.due ?? o.due_date ?? "",
          assignee: e.assignee ?? fallback,
        };
      }),
    )
    .sort(
      (a, b) =>
        (a.o.due_date ?? "9999").localeCompare(b.o.due_date ?? "9999") ||
        a.x.template.title.localeCompare(b.x.template.title),
    );
  const open = rows.filter((r) => !r.exists && !r.blocked);
  const picked = rows.filter((r) => r.selected);
  const missing = picked.filter((r) => !r.assignee).length;
  const edit = (key: string, e: Edit) => setEdits((es) => ({ ...es, [key]: { ...es[key], ...e } }));
  async function create() {
    if (!supabase || preview) return;
    setBusy(true);
    setError("");
    try {
      const payload = picked.map((r) =>
        templateTask(r.x.template, { ...r.o, due_date: r.due || null }, company.id, r.assignee, reporting),
      );
      const { data, error } = await supabase
        .from("tasks")
        .upsert(payload, { onConflict: "company_id,template_key,period_label", ignoreDuplicates: true })
        .select("id");
      if (error) throw new Error(error.message);
      const made = data?.length ?? 0;
      // Remember the person when every new row for a checklist item went to the same person.
      const people = new Map<string, string>();
      for (const r of picked)
        if (r.x.item) people.set(r.x.item.id, people.has(r.x.item.id) && people.get(r.x.item.id) !== r.assignee ? "" : r.assignee);
      const changes = [...people].filter(
        ([id, person]) => person && items.find((x) => x.item?.id === id)?.item?.default_assignee !== person,
      );
      const results = await Promise.all(
        changes.map(([id, person]) =>
          supabase!.from("company_checklist_items").update({ default_assignee: person }).eq("id", id),
        ),
      );
      setEdits({});
      onSaved(
        `${plural(made, "responsibility", "responsibilities")} created` +
          (payload.length > made ? `; ${payload.length - made} already existed` : "") +
          "." +
          (results.some((r) => r.error) ? " Default assignees were not saved." : ""),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create responsibilities");
    } finally {
      setBusy(false);
    }
  }
  if (!items.length)
    return (
      <section className="panel">
        <Empty
          title="No active checklist items"
          body="Review and activate the checklist before creating responsibilities."
        />
        <div className="button-row step-actions">
          <button className="button secondary" onClick={onBack}>
            <ArrowLeft size={16} />
            Review checklist
          </button>
        </div>
      </section>
    );
  return (
    <>
      <section className="panel">
        <h2>Apply checklist</h2>
        <p className="muted section-copy">
          Responsibilities are created for {company.name} where the statutory due date
          falls in the window. Check each date against current notifications before
          creating them.
        </p>
        <div className="apply-controls">
          <Field label="Due dates">
            <select
              value={preset}
              onChange={(e) => {
                const v = e.target.value as WindowPreset;
                setPreset(v);
                if (v !== "custom") setRange(windowFor(v, today));
              }}
            >
              <option value="month">This month</option>
              <option value="quarter">Next three months</option>
              <option value="fy">Rest of this financial year</option>
              <option value="custom">Custom range</option>
            </select>
          </Field>
          <Field label="From">
            <input
              type="date"
              value={range.from}
              onChange={(e) => {
                setPreset("custom");
                setRange({ ...range, from: e.target.value });
              }}
            />
          </Field>
          <Field label="To">
            <input
              type="date"
              value={range.to}
              onChange={(e) => {
                setPreset("custom");
                setRange({ ...range, to: e.target.value });
              }}
            />
          </Field>
          <Field label="Reporting person (optional)">
            <input value={reporting} onChange={(e) => setReporting(e.target.value)} />
          </Field>
        </div>
        {invalid && (
          <p className="error">Choose a window of up to 24 months that starts before it ends.</p>
        )}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Checklist items</h2>
          <span className="muted">
            {items.filter(isChosen).length} of {items.length} selected
          </span>
        </div>
        <div className="item-chips">
          {[...items]
            .sort((a, b) => byArea(a.template, b.template))
            .map((x) => (
              <label className="chip" key={x.template.id}>
                <input
                  type="checkbox"
                  checked={isChosen(x)}
                  onChange={(e) => setChosen((c) => ({ ...c, [x.template.id]: e.target.checked }))}
                />
                {x.template.title}
              </label>
            ))}
        </div>
        <p className="muted">Event-based items have no fixed date and start unselected.</p>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>{plural(rows.length, "responsibility", "responsibilities")} in this window</h2>
            <p className="muted">
              {picked.length} selected · {rows.filter((r) => r.exists).length} already created
            </p>
          </div>
        </div>
        {rows.length > 0 && (
          <div className="bulk-bar">
            <label className="check-field">
              <input
                type="checkbox"
                checked={!!open.length && open.every((r) => r.selected)}
                disabled={!open.length}
                onChange={(e) => {
                  const next = { ...edits };
                  for (const r of open) next[r.key] = { ...next[r.key], selected: e.target.checked };
                  setEdits(next);
                }}
              />
              Select all
            </label>
            <select aria-label="Assign selected to" value={bulk} onChange={(e) => setBulk(e.target.value)}>
              <option value="">Assign selected to…</option>
              {updaters.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
            <button
              className="button secondary"
              disabled={!bulk || !picked.length}
              onClick={() => {
                const next = { ...edits };
                for (const r of picked) next[r.key] = { ...next[r.key], assignee: bulk };
                setEdits(next);
              }}
            >
              <UsersRound size={16} />
              Assign {picked.length}
            </button>
          </div>
        )}
        <div className="apply-list">
          {rows.map((r) => (
            <div className={"apply-row" + (r.exists || r.blocked ? " inactive" : "")} key={r.key}>
              <input
                type="checkbox"
                aria-label={`Select ${r.x.template.title}, ${r.o.period_label}`}
                checked={r.selected}
                disabled={r.exists || r.blocked}
                onChange={(e) => edit(r.key, { selected: e.target.checked })}
              />
              <div className="apply-main">
                <strong>{r.x.template.title}</strong>
                <small>
                  {r.o.period_label} · {r.x.template.area}
                </small>
                {r.exists && <Badge status="Already created" />}
                {r.blocked && (
                  <span className="review-label">
                    <TriangleAlert size={14} />
                    Template needs review in the library
                  </span>
                )}
                {r.o.notes.map((n) => (
                  <small key={n}>{n}</small>
                ))}
                {r.o.flags.map((f) => (
                  <span className="review-label" key={f}>
                    <TriangleAlert size={14} />
                    {f}
                  </span>
                ))}
              </div>
              <label className="apply-field">
                <span>Due date</span>
                <input
                  type="date"
                  value={r.due}
                  disabled={r.exists || r.blocked}
                  onChange={(e) => edit(r.key, { due: e.target.value })}
                />
              </label>
              <label className="apply-field">
                <span>Assign to</span>
                <select
                  value={r.assignee}
                  disabled={r.exists || r.blocked}
                  onChange={(e) => edit(r.key, { assignee: e.target.value })}
                >
                  <option value="">Choose person</option>
                  {updaters.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ))}
        </div>
        {!rows.length && !invalid && (
          <Empty
            title="Nothing falls due in this window"
            body="Choose a longer window or select more checklist items."
          />
        )}
      </section>
      <section className="panel">
        {preview && (
          <p className="notice">
            Preview: responsibilities are not created. Connect Supabase to save them.
          </p>
        )}
        {missing > 0 && (
          <ul className="review-flags">
            <li>
              {plural(missing, "selected responsibility needs", "selected responsibilities need")} a
              person.
            </li>
          </ul>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="button-row step-actions">
          <button className="button secondary" onClick={onBack}>
            <ArrowLeft size={16} />
            Review checklist
          </button>
          <button
            className="button"
            disabled={busy || preview || !picked.length || missing > 0}
            onClick={() => void create()}
          >
            <Plus size={16} />
            {busy ? "Creating…" : `Create ${plural(picked.length, "responsibility", "responsibilities")}`}
          </button>
        </div>
      </section>
    </>
  );
}
