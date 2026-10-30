import { dateLabel, todayISO } from "./model";
import { templateSeed } from "@/data/compliance-templates";
export const areas = ["GST", "Income Tax", "Company / ROC"] as const;
export type Area = (typeof areas)[number];
export const templateFrequencies = [
  "Monthly",
  "Quarterly",
  "Half-yearly",
  "Annually",
  "Event-based",
  "One-time",
] as const;
export type TemplateFrequency = (typeof templateFrequencies)[number];
export const reviewStatuses = ["Needs review", "Reviewed", "Retired"] as const;
export type ReviewStatus = (typeof reviewStatuses)[number];
export type Offset = { months_after?: number; day?: number; days_after?: number };
export type CycleAnswer = "dir3_kyc_year" | "auditor_appointment_year";
export type Extension = { period: string; due_date: string; reference: string };
export type DeadlineRule = Offset & {
  kind: "monthly" | "quarterly" | "half_yearly" | "annual" | "after_event" | "event";
  basis?: "tax_fy" | "company_fy" | "calendar";
  event?: "agm" | "incorporation";
  event_text?: string;
  only_periods?: number[];
  overrides?: (Offset & { period: number })[];
  when?: (Offset & { fact: string })[];
  cycle?: { every_years: number; answer: CycleAnswer };
  extensions?: Extension[];
};
export type Reference = { label: string; url?: string };
export type Applicability = { all?: string[]; any?: string[]; none?: string[] };
export type TemplateSeed = {
  code: string;
  area: Area;
  title: string;
  form_name: string | null;
  description: string;
  objective: string | null;
  activity: string | null;
  frequency: TemplateFrequency;
  deadline_rule: DeadlineRule;
  deadline_text: string;
  required_documents: string[];
  official_references: Reference[];
  applicability: Applicability;
  review_notes: string;
  last_verified_on: string | null;
};
export type ComplianceTemplate = TemplateSeed & {
  id: string;
  review_status: ReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};
export type CompanyProfile = {
  id: string;
  company_id: string;
  answers: Partial<Answers>;
  questionnaire_version: number;
  updated_by: string | null;
  checklist_activated_by: string | null;
  checklist_activated_at: string | null;
  created_at: string;
  updated_at: string;
};
export type ChecklistItem = {
  id: string;
  company_id: string;
  template_id: string;
  status: "Active" | "Excluded";
  origin: "Suggested" | "Added manually";
  reasons: string[];
  note: string;
  default_assignee: string | null;
  reviewed_by: string | null;
  reviewed_at: string;
  created_at: string;
  updated_at: string;
};
export const previewTemplates: ComplianceTemplate[] = templateSeed.map((t) => ({
  ...t,
  id: t.code,
  review_status: "Needs review",
  reviewed_by: null,
  reviewed_at: null,
  created_at: "",
  updated_at: "",
}));
export const factGroups: { title: string; facts: [string, string][] }[] = [
  {
    title: "Entity",
    facts: [
      ["company", "Company under the Companies Act, 2013"],
      ["private_company", "Private limited company"],
      ["public_company", "Unlisted public company"],
      ["opc", "One Person Company"],
      ["section8", "Section 8 company"],
      ["small_company", "Small company"],
      ["llp", "Limited liability partnership"],
      ["firm", "Partnership firm"],
      ["proprietorship", "Proprietorship"],
      ["incorporated_recently", "Incorporated in the last 12 months"],
    ],
  },
  {
    title: "GST",
    facts: [
      ["gst_registered", "GST registered"],
      ["gst_regular", "GST regular taxpayer"],
      ["gst_monthly", "Files GST returns monthly"],
      ["gst_qrmp", "QRMP scheme (quarterly GST returns)"],
      ["gst_qrmp_24th", "All GSTINs in 24th-day states (QRMP)"],
      ["gst_composition", "GST composition scheme"],
      ["gst_turnover_above_2cr", "GST turnover above ₹2 crore"],
      ["gst_turnover_above_5cr", "GST turnover above ₹5 crore"],
      ["gst_job_work", "Sends goods for job work"],
      ["gst_isd", "Input Service Distributor"],
      ["gst_tds", "Deducts GST TDS"],
      ["gst_ecommerce_tcs", "E-commerce operator collecting GST TCS"],
    ],
  },
  {
    title: "Income tax",
    facts: [
      ["tds_deductor", "Deducts TDS"],
      ["tds_salary", "Deducts TDS on salaries"],
      ["tds_non_resident", "Pays non-residents subject to TDS"],
      ["tcs_collector", "Collects TCS"],
      ["advance_tax", "Liable to advance tax"],
      ["tax_audit", "Tax audit applies"],
      ["transfer_pricing", "Transfer pricing report required"],
      ["sft_reporting", "Files SFT statement"],
    ],
  },
  {
    title: "Company law",
    facts: [
      ["deposit_return", "Loans or deposits to report (DPT-3)"],
      ["msme_dues", "MSME dues beyond 45 days"],
      ["pas6", "PAS-6 reconciliation applies"],
      ["csr", "CSR provisions apply"],
      ["xbrl", "Files in XBRL"],
      ["subsidiaries", "Has subsidiaries or associates"],
    ],
  },
];
export const factLabels: Record<string, string> = Object.fromEntries(
  factGroups.flatMap((g) => g.facts),
);
export const entityTypes = [
  ["private", "Private limited company"],
  ["public", "Public limited company (unlisted)"],
  ["opc", "One Person Company"],
  ["section8", "Section 8 company"],
  ["llp", "Limited liability partnership (LLP)"],
  ["firm", "Partnership firm"],
  ["proprietorship", "Proprietorship"],
  ["other", "Other"],
] as const;
export type EntityType = (typeof entityTypes)[number][0];
export const companyTypes: string[] = ["private", "public", "opc", "section8"];
export type Answers = {
  entity_type: EntityType | "";
  small_company: boolean;
  incorporation_date: string;
  registration_number: string;
  fy_start_month: number;
  pan: string;
  tan: string;
  gstins: string[];
  gst_type: "" | "none" | "regular" | "composition";
  gst_filing: "monthly" | "qrmp";
  gst_turnover: "" | "upto_2cr" | "2_to_5cr" | "above_5cr";
  gst_job_work: boolean;
  gst_isd: boolean;
  gst_tds: boolean;
  gst_ecommerce_tcs: boolean;
  tds_deductor: boolean;
  tds_salary: boolean;
  tds_non_resident: boolean;
  tcs_collector: boolean;
  advance_tax: boolean;
  tax_audit: boolean;
  transfer_pricing: boolean;
  sft_reporting: boolean;
  agm_month: number | null;
  agm_day: number | null;
  auditor_appointment_year: number | null;
  dir3_kyc_year: number | null;
  deposit_return: boolean;
  msme_dues: boolean;
  pas6: boolean;
  csr: boolean;
  xbrl: boolean;
  subsidiaries: boolean;
  notes: string;
};
export const emptyAnswers: Answers = {
  entity_type: "",
  small_company: false,
  incorporation_date: "",
  registration_number: "",
  fy_start_month: 4,
  pan: "",
  tan: "",
  gstins: [],
  gst_type: "",
  gst_filing: "monthly",
  gst_turnover: "",
  gst_job_work: false,
  gst_isd: false,
  gst_tds: false,
  gst_ecommerce_tcs: false,
  tds_deductor: false,
  tds_salary: false,
  tds_non_resident: false,
  tcs_collector: false,
  advance_tax: false,
  tax_audit: false,
  transfer_pricing: false,
  sft_reporting: false,
  agm_month: null,
  agm_day: null,
  auditor_appointment_year: null,
  dir3_kyc_year: null,
  deposit_return: false,
  msme_dues: false,
  pas6: false,
  csr: false,
  xbrl: false,
  subsidiaries: false,
  notes: "",
};
// Coerces stored or edited answers to the current questionnaire shape.
export function normalizeAnswers(raw: unknown): Answers {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = { ...emptyAnswers };
  for (const [k, base] of Object.entries(emptyAnswers)) {
    const v = r[k];
    if (Array.isArray(base))
      out[k] = Array.isArray(v)
        ? v.map((x) => String(x).trim().toUpperCase()).filter(Boolean)
        : [];
    else if (typeof base === "boolean") out[k] = v === true;
    else if (typeof base === "string") out[k] = typeof v === "string" ? v : base;
    else {
      const n = Number(v);
      out[k] =
        v === null || v === "" || v === undefined || !Number.isInteger(n)
          ? base
          : n;
    }
  }
  const a = out as Answers;
  if (!entityTypes.some(([v]) => v === a.entity_type)) a.entity_type = "";
  if (!["", "none", "regular", "composition"].includes(a.gst_type))
    a.gst_type = "";
  if (!["monthly", "qrmp"].includes(a.gst_filing)) a.gst_filing = "monthly";
  if (!["", "upto_2cr", "2_to_5cr", "above_5cr"].includes(a.gst_turnover))
    a.gst_turnover = "";
  if (a.fy_start_month < 1 || a.fy_start_month > 12) a.fy_start_month = 4;
  return a;
}
export const sameAnswers = (a: Answers, b: Answers) =>
  JSON.stringify(a) === JSON.stringify(b);
export const patterns = {
  pan: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
  tan: /^[A-Z]{4}[0-9]{5}[A-Z]$/,
  gstin: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
};
// GSTR-3B under QRMP is due on the 24th for these state codes, and on the 22nd elsewhere.
export const day24StateCodes = [
  "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11",
  "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "38",
];
export function answerWarnings(a: Answers) {
  const w: string[] = [];
  if (a.pan && !patterns.pan.test(a.pan)) w.push("PAN should look like ABCDE1234F.");
  if (a.tan && !patterns.tan.test(a.tan)) w.push("TAN should look like ABCD12345E.");
  for (const g of a.gstins) {
    if (!patterns.gstin.test(g)) w.push(`${g} is not a valid GSTIN format.`);
    else if (a.pan && g.slice(2, 12) !== a.pan)
      w.push(`${g} does not contain the PAN entered above.`);
  }
  if (
    a.gst_type === "regular" &&
    a.gst_filing === "qrmp" &&
    a.gst_turnover === "above_5cr"
  )
    w.push("QRMP is available only up to ₹5 crore aggregate turnover.");
  if (a.gst_type === "regular" && a.gst_filing === "qrmp" && !a.gstins.length)
    w.push("Add GSTINs so the QRMP GSTR-3B date (22nd or 24th) can follow the state.");
  return w;
}
export function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
const pad = (n: number) => String(n).padStart(2, "0");
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
// Month numbers may run past 12 or below 1; days past the month end use its last day.
export function isoDate(y: number, m: number, d: number) {
  const t = new Date(Date.UTC(y, m - 1, 1));
  const yy = t.getUTCFullYear(),
    mm = t.getUTCMonth() + 1;
  return `${yy}-${pad(mm)}-${pad(Math.min(d, daysIn(yy, mm)))}`;
}
export function deriveFacts(a: Answers, today = todayISO()) {
  const f = new Set<string>();
  const add = (k: string, on: boolean) => {
    if (on) f.add(k);
  };
  const company = companyTypes.includes(a.entity_type);
  const regular = a.gst_type === "regular";
  const registered = regular || a.gst_type === "composition";
  add("company", company);
  add("private_company", a.entity_type === "private");
  add("public_company", a.entity_type === "public");
  add("opc", a.entity_type === "opc");
  add("section8", a.entity_type === "section8");
  add("small_company", a.entity_type === "private" && a.small_company);
  add("llp", a.entity_type === "llp");
  add("firm", a.entity_type === "firm");
  add("proprietorship", a.entity_type === "proprietorship");
  add(
    "incorporated_recently",
    !!a.incorporation_date &&
      a.incorporation_date <= today &&
      a.incorporation_date > addDays(today, -365),
  );
  add("gst_registered", registered);
  add("gst_regular", regular);
  add("gst_monthly", regular && a.gst_filing === "monthly");
  add("gst_qrmp", regular && a.gst_filing === "qrmp");
  add(
    "gst_qrmp_24th",
    regular &&
      a.gst_filing === "qrmp" &&
      a.gstins.length > 0 &&
      a.gstins.every((g) => day24StateCodes.includes(g.slice(0, 2))),
  );
  add("gst_composition", a.gst_type === "composition");
  add(
    "gst_turnover_above_2cr",
    regular && ["2_to_5cr", "above_5cr"].includes(a.gst_turnover),
  );
  add("gst_turnover_above_5cr", regular && a.gst_turnover === "above_5cr");
  add("gst_job_work", regular && a.gst_job_work);
  add("gst_isd", a.gst_isd);
  add("gst_tds", a.gst_tds);
  add("gst_ecommerce_tcs", a.gst_ecommerce_tcs);
  add("tds_deductor", a.tds_deductor || a.tds_salary || a.tds_non_resident);
  add("tds_salary", a.tds_salary);
  add("tds_non_resident", a.tds_non_resident);
  for (const k of [
    "tcs_collector",
    "advance_tax",
    "tax_audit",
    "transfer_pricing",
    "sft_reporting",
  ] as const)
    add(k, a[k]);
  for (const k of [
    "deposit_return",
    "msme_dues",
    "pas6",
    "csr",
    "xbrl",
    "subsidiaries",
  ] as const)
    add(k, company && a[k]);
  return f;
}
export function applies(app: Applicability, facts: Set<string>) {
  const all = app.all ?? [],
    any = app.any ?? [],
    none = app.none ?? [];
  return (
    all.length + any.length > 0 &&
    all.every((k) => facts.has(k)) &&
    (!any.length || any.some((k) => facts.has(k))) &&
    !none.some((k) => facts.has(k))
  );
}
export function suggestTemplates(
  templates: ComplianceTemplate[],
  answers: Answers,
  today = todayISO(),
) {
  const facts = deriveFacts(answers, today);
  return templates
    .filter((t) => t.review_status !== "Retired" && applies(t.applicability, facts))
    .map((t) => ({
      template: t,
      reasons: [
        ...(t.applicability.all ?? []),
        ...(t.applicability.any ?? []).filter((k) => facts.has(k)),
      ].map((k) => factLabels[k] ?? k),
    }));
}
export const templateKey = (t: { code: string }) => `tpl:${t.code}`;
const areaOrder = (a: string) => areas.indexOf(a as Area);
export const byArea = (a: ComplianceTemplate, b: ComplianceTemplate) =>
  areaOrder(a.area) - areaOrder(b.area) || a.title.localeCompare(b.title);
export type ChecklistRow = {
  template: ComplianceTemplate;
  origin: ChecklistItem["origin"];
  reasons: string[];
  suggested: boolean;
  item?: ChecklistItem;
};
// Suggestions from the answers, earlier decisions and manual additions, one row per template.
export function checklistRows(
  templates: ComplianceTemplate[],
  answers: Answers,
  items: ChecklistItem[],
  added: string[],
  today = todayISO(),
) {
  const rows = new Map<string, ChecklistRow>();
  for (const s of suggestTemplates(templates, answers, today))
    rows.set(s.template.id, {
      template: s.template,
      origin:
        items.find((i) => i.template_id === s.template.id)?.origin ??
        "Suggested",
      reasons: s.reasons,
      suggested: true,
      item: items.find((i) => i.template_id === s.template.id),
    });
  for (const i of items) {
    const t = templates.find((x) => x.id === i.template_id);
    if (t && !rows.has(t.id))
      rows.set(t.id, {
        template: t,
        origin: i.origin,
        reasons: i.reasons,
        suggested: false,
        item: i,
      });
  }
  for (const id of added) {
    const t = templates.find((x) => x.id === id);
    if (t && !rows.has(id))
      rows.set(id, {
        template: t,
        origin: "Added manually",
        reasons: [],
        suggested: false,
      });
  }
  return [...rows.values()].sort((a, b) => byArea(a.template, b.template));
}
export type Occurrence = {
  period_label: string;
  period_end: string;
  due_date: string | null;
  notes: string[];
  flags: string[];
};
export const monthNames = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
export function fyLabel(startYear: number, startMonth = 4) {
  return startMonth === 1
    ? `FY ${startYear}`
    : `FY ${startYear}-${pad((startYear + 1) % 100)}`;
}
const pickOffset = (o: Offset): Offset =>
  o.days_after != null
    ? { days_after: o.days_after }
    : { months_after: o.months_after ?? 0, day: o.day ?? 31 };
// Due date for a period ending in month (y, m): a day N months later, or N days after the period end.
function dueFrom(y: number, m: number, o: Offset) {
  return o.days_after != null
    ? addDays(isoDate(y, m, 31), o.days_after)
    : isoDate(y, m + (o.months_after ?? 0), o.day ?? 31);
}
// Statutory occurrences of a template whose due dates fall within [from, to].
export function occurrences(
  t: Pick<ComplianceTemplate, "deadline_rule">,
  a: Answers,
  from: string,
  to: string,
): Occurrence[] {
  const r = t.deadline_rule;
  const facts = deriveFacts(a);
  const start =
    r.basis === "calendar" ? 1 : r.basis === "company_fy" ? a.fy_start_month : 4;
  const fromY = Number(from.slice(0, 4)),
    toY = Number(to.slice(0, 4));
  const year = (fy: number) => (r.basis === "calendar" ? String(fy) : fyLabel(fy, start));
  const fact = r.when?.find((w) => facts.has(w.fact));
  const offset = (period: number) =>
    pickOffset(r.overrides?.find((o) => o.period === period) ?? fact ?? r);
  const out: Occurrence[] = [];
  function cycleFlags(due: string) {
    if (!r.cycle) return [];
    const year = a[r.cycle.answer];
    const dueYear = Number(due.slice(0, 4));
    if (year === null)
      return [
        `Filed once every ${r.cycle.every_years} years. Keep this only if it falls due in ${dueYear}.`,
      ];
    return (((dueYear - year) % r.cycle.every_years) + r.cycle.every_years) %
      r.cycle.every_years
      ? null
      : [];
  }
  function add(label: string, end: string, due: string, flags: string[] = []) {
    const cf = cycleFlags(due);
    if (!cf) return;
    const notes: string[] = [];
    const ext = r.extensions?.find((e) => e.period === label);
    if (ext) {
      notes.push(
        `Extended from ${dateLabel(due)} to ${dateLabel(ext.due_date)} (${ext.reference})`,
      );
      due = ext.due_date;
    }
    if (a.incorporation_date && end < a.incorporation_date) return;
    if (due < from || due > to) return;
    out.push({ period_label: label, period_end: end, due_date: due, notes, flags: [...flags, ...cf] });
  }
  if (r.kind === "monthly") {
    const first = Number(from.slice(0, 4)) * 12 + Number(from.slice(5, 7)) - 16;
    for (let k = first; isoDate(Math.floor(k / 12), (k % 12) + 1, 1) <= to; k++) {
      const y = Math.floor(k / 12),
        m = (k % 12) + 1;
      if (r.only_periods && !r.only_periods.includes(m)) continue;
      add(`${monthNames[m - 1]} ${y}`, isoDate(y, m, 31), dueFrom(y, m, offset(m)));
    }
  } else if (r.kind === "quarterly" || r.kind === "half_yearly") {
    const size = r.kind === "quarterly" ? 3 : 6;
    for (let fy = fromY - 2; fy <= toY + 1; fy++)
      for (let p = 1; p <= 12 / size; p++) {
        const endAbs = fy * 12 + start - 1 + size * p - 1;
        const y = Math.floor(endAbs / 12),
          m = (endAbs % 12) + 1;
        add(
          `${size === 3 ? "Q" : "H"}${p} ${year(fy)}`,
          isoDate(y, m, 31),
          dueFrom(y, m, offset(p)),
        );
      }
  } else if (r.kind === "annual") {
    for (let fy = fromY - 2; fy <= toY; fy++) {
      const endAbs = fy * 12 + start - 1 + 11;
      const y = Math.floor(endAbs / 12),
        m = (endAbs % 12) + 1;
      add(year(fy), isoDate(y, m, 31), dueFrom(y, m, offset(1)));
    }
  } else if (r.kind === "after_event" && r.event === "incorporation") {
    if (a.incorporation_date) {
      const due = addDays(a.incorporation_date, r.days_after ?? 0);
      if (due >= from && due <= to)
        out.push({
          period_label: "One-time",
          period_end: a.incorporation_date,
          due_date: due,
          notes: [],
          flags: [],
        });
    }
  } else if (r.kind === "after_event") {
    const planned =
      a.entity_type !== "opc" && a.agm_month !== null && a.agm_day !== null;
    for (let fy = fromY - 2; fy <= toY; fy++) {
      const endAbs = fy * 12 + start - 1 + 11;
      const y = Math.floor(endAbs / 12),
        m = (endAbs % 12) + 1;
      const end = isoDate(y, m, 31);
      const latest = isoDate(y, m + 6, 31);
      let agm = latest;
      if (planned) {
        agm = isoDate(y, a.agm_month!, a.agm_day!);
        if (agm <= end) agm = isoDate(y + 1, a.agm_month!, a.agm_day!);
      }
      const flags = [
        a.entity_type === "opc"
          ? `Counted from ${dateLabel(latest)}, the last date an AGM would have been due.`
          : planned
            ? `Based on the planned AGM on ${dateLabel(agm)}. Confirm after the meeting.`
            : `Based on the last date for the AGM (${dateLabel(latest)}). Update after the meeting.`,
      ];
      if (planned && agm > latest)
        flags.push("The planned AGM date is after the statutory deadline.");
      add(year(fy), end, addDays(agm, r.days_after ?? 0), flags);
    }
  } else {
    for (let fy = fromY - 1; fy <= toY; fy++) {
      const s = isoDate(fy, start, 1),
        end = isoDate(fy, start + 11, 31);
      if (end < from || s > to) continue;
      if (a.incorporation_date && end < a.incorporation_date) continue;
      out.push({
        period_label: `${year(fy)} (as required)`,
        period_end: end,
        due_date: null,
        notes: [],
        flags: [r.event_text || "Set the due date when this event occurs."],
      });
    }
  }
  return out.sort((x, y) =>
    (x.due_date ?? "9999").localeCompare(y.due_date ?? "9999"),
  );
}
// A WorkLedger responsibility for one occurrence of a reviewed template.
export function templateTask(
  t: ComplianceTemplate,
  o: Occurrence,
  company_id: string,
  assigned_to: string,
  reporting_person: string,
) {
  return {
    company_id,
    assigned_to,
    particular: t.title,
    objective: t.objective,
    activity: t.activity,
    category: t.area,
    frequency: t.frequency,
    documents_required: t.required_documents.join("\n") || null,
    timeline_text: t.deadline_text,
    reporting_person: reporting_person.trim() || null,
    source_pdf_name: null,
    source_reference: [`Compliance library: ${t.code}`, ...o.notes].join(" · "),
    source_company: null,
    status: "Pending" as const,
    completion_date: null,
    remarks: "",
    due_date: o.due_date,
    period_label: o.period_label,
    template_key: templateKey(t),
    compliance_template_id: t.id,
    review_required: !o.due_date || o.flags.length > 0,
    review_flags: o.flags,
  };
}
export type WindowPreset = "month" | "quarter" | "fy" | "custom";
export function windowFor(preset: Exclude<WindowPreset, "custom">, today: string) {
  const y = Number(today.slice(0, 4)),
    m = Number(today.slice(5, 7));
  return {
    from: isoDate(y, m, 1),
    to:
      preset === "month"
        ? isoDate(y, m, 31)
        : preset === "quarter"
          ? isoDate(y, m + 2, 31)
          : isoDate(m >= 4 ? y + 1 : y, 3, 31),
  };
}
const ordinal = (n: number) =>
  n +
  (n % 10 === 1 && n % 100 !== 11
    ? "st"
    : n % 10 === 2 && n % 100 !== 12
      ? "nd"
      : n % 10 === 3 && n % 100 !== 13
        ? "rd"
        : "th");
function describeOffset(o: Offset, unit: string) {
  if (o.days_after != null) return `${o.days_after} days after the ${unit} ends`;
  const m = o.months_after ?? 0,
    d = o.day ?? 31;
  const day = d >= 31 ? "last day" : ordinal(d);
  return m === 0
    ? `on the ${day} of the ${unit}'s last month`
    : `on the ${day} of the ${m > 1 ? `${ordinal(m)} month after the ${unit}` : unit === "month" ? "following month" : `month after the ${unit}`}`;
}
const cycleLabels: Record<CycleAnswer, string> = {
  dir3_kyc_year: "next DIR-3 KYC year",
  auditor_appointment_year: "next auditor appointment year",
};
export function describeRule(r: DeadlineRule) {
  const basis =
    r.basis === "calendar"
      ? "calendar year"
      : r.basis === "company_fy"
        ? "company financial year"
        : "April–March year";
  const unit =
    r.kind === "monthly"
      ? "month"
      : r.kind === "quarterly"
        ? "quarter"
        : r.kind === "half_yearly"
          ? "half-year"
          : "year";
  const lines = [
    r.kind === "monthly"
      ? `Every month, due ${describeOffset(r, unit)}`
      : r.kind === "quarterly" || r.kind === "half_yearly"
        ? `Every ${unit} of the ${basis}, due ${describeOffset(r, unit)}`
        : r.kind === "annual"
          ? `Every ${basis}, due ${describeOffset(r, unit)}`
          : r.kind === "after_event"
            ? r.event === "incorporation"
              ? `Once, ${r.days_after ?? 0} days after incorporation`
              : `Every ${basis}, ${r.days_after ?? 0} days after the AGM (or the last date for holding it)`
            : `As required: ${r.event_text || "set the due date when the event occurs"}`,
  ];
  if (r.only_periods?.length)
    lines.push(`Only for ${r.only_periods.map((m) => monthNames[m - 1]).join(", ")}`);
  for (const o of r.overrides ?? [])
    lines.push(
      `${r.kind === "monthly" ? monthNames[o.period - 1] : (r.kind === "quarterly" ? "Q" : "H") + o.period}: due ${describeOffset(o, unit)}`,
    );
  for (const w of r.when ?? [])
    lines.push(`${factLabels[w.fact] ?? w.fact}: due ${describeOffset(w, unit)}`);
  if (r.cycle)
    lines.push(
      `Repeats every ${r.cycle.every_years} years, from the ${cycleLabels[r.cycle.answer]} in the questionnaire`,
    );
  for (const e of r.extensions ?? [])
    lines.push(`${e.period}: extended to ${dateLabel(e.due_date)} (${e.reference})`);
  return lines;
}
export function describeApplicability(app: Applicability) {
  const label = (ks?: string[]) => (ks ?? []).map((k) => factLabels[k] ?? k);
  const parts: string[] = [];
  if (app.all?.length) parts.push(label(app.all).join(" and "));
  if (app.any?.length) parts.push(`any of: ${label(app.any).join(", ")}`);
  if (!parts.length) return "Not suggested automatically. Add it to a checklist manually.";
  return (
    "Suggested for " +
    parts.join("; ") +
    (app.none?.length ? `. Not for: ${label(app.none).join(", ")}.` : ".")
  );
}
export const isSafeUrl = (url?: string) => !!url && /^https:\/\/[^\s]+$/i.test(url);
export type RuleType =
  | "monthly"
  | "quarterly"
  | "half_yearly"
  | "annual"
  | "agm"
  | "incorporation"
  | "event";
export const ruleTypes: [RuleType, string, TemplateFrequency][] = [
  ["monthly", "Monthly, after each month", "Monthly"],
  ["quarterly", "Quarterly, after each quarter", "Quarterly"],
  ["half_yearly", "Half-yearly, after each half-year", "Half-yearly"],
  ["annual", "Annual, after each financial year", "Annually"],
  ["agm", "Annual, after the AGM", "Annually"],
  ["incorporation", "One-time, after incorporation", "One-time"],
  ["event", "As required, no fixed date", "Event-based"],
];
export const ruleType = (r: DeadlineRule): RuleType =>
  r.kind === "after_event"
    ? r.event === "incorporation"
      ? "incorporation"
      : "agm"
    : r.kind;
export type Condition = "all" | "any" | "none";
export type TemplateDraft = {
  id: string;
  updated_at: string;
  code: string;
  area: Area;
  title: string;
  form_name: string;
  description: string;
  objective: string;
  activity: string;
  deadline_text: string;
  type: RuleType;
  original_type: RuleType | null;
  basis: NonNullable<DeadlineRule["basis"]>;
  mode: "month_day" | "days";
  months_after: string;
  day: string;
  days_after: string;
  event_text: string;
  documents: string;
  references: string;
  extensions: string;
  conditions: Record<string, Condition>;
  review_notes: string;
  retired: boolean;
  confirmed: boolean;
  keep: Pick<DeadlineRule, "only_periods" | "overrides" | "when" | "cycle">;
};
export function templateDraft(t?: ComplianceTemplate): TemplateDraft {
  const r = t?.deadline_rule ?? { kind: "monthly", months_after: 1, day: 10 };
  const conditions: Record<string, Condition> = {};
  for (const c of ["all", "any", "none"] as const)
    for (const k of t?.applicability[c] ?? []) conditions[k] = c;
  return {
    id: t?.id ?? "",
    updated_at: t?.updated_at ?? "",
    code: t?.code ?? "",
    area: t?.area ?? "GST",
    title: t?.title ?? "",
    form_name: t?.form_name ?? "",
    description: t?.description ?? "",
    objective: t?.objective ?? "",
    activity: t?.activity ?? "",
    deadline_text: t?.deadline_text ?? "",
    type: ruleType(r),
    original_type: t ? ruleType(r) : null,
    basis: r.basis ?? "tax_fy",
    mode: r.days_after != null ? "days" : "month_day",
    months_after: String(r.months_after ?? 1),
    day: String(r.day ?? 31),
    days_after: String(r.days_after ?? 30),
    event_text: r.event_text ?? "",
    documents: (t?.required_documents ?? []).join("\n"),
    references: (t?.official_references ?? [])
      .map((x) => (x.url ? `${x.label} | ${x.url}` : x.label))
      .join("\n"),
    extensions: (r.extensions ?? [])
      .map((e) => `${e.period} | ${e.due_date} | ${e.reference}`)
      .join("\n"),
    conditions,
    review_notes: t?.review_notes ?? "",
    retired: t?.review_status === "Retired",
    confirmed: false,
    keep: {
      only_periods: r.only_periods,
      overrides: r.overrides,
      when: r.when,
      cycle: r.cycle,
    },
  };
}
const lines = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
// Validates a template form and returns the stored fields.
export function draftPayload(
  d: TemplateDraft,
):
  | {
      ok: true;
      value: Omit<TemplateSeed, "last_verified_on"> & { review_status: ReviewStatus };
    }
  | { ok: false; error: string } {
  const fail = (error: string) => ({ ok: false as const, error });
  const code = d.code.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{1,47}$/.test(code))
    return fail("Code needs 2–48 capital letters, numbers or hyphens.");
  if (!d.title.trim()) return fail("Add a title.");
  if (!d.deadline_text.trim()) return fail("Describe the deadline in words.");
  const int = (v: string, min: number, max: number) => {
    const n = Number(v);
    return v.trim() !== "" && Number.isInteger(n) && n >= min && n <= max ? n : null;
  };
  const rule: DeadlineRule = {
    kind:
      d.type === "agm" || d.type === "incorporation" ? "after_event" : d.type,
  };
  if (d.type === "agm" || d.type === "incorporation") rule.event = d.type;
  if (d.type !== "monthly" && d.type !== "incorporation" && d.basis !== "tax_fy")
    rule.basis = d.basis;
  if (d.type === "event") {
    if (d.event_text.trim()) rule.event_text = d.event_text.trim();
  } else if (d.type === "agm" || d.type === "incorporation" || d.mode === "days") {
    const n = int(d.days_after, 0, 730);
    if (n === null) return fail("Days after must be a whole number from 0 to 730.");
    rule.days_after = n;
  } else {
    const m = int(d.months_after, 0, 24),
      day = int(d.day, 1, 31);
    if (m === null) return fail("Months after must be a whole number from 0 to 24.");
    if (day === null) return fail("Day must be from 1 to 31.");
    rule.months_after = m;
    rule.day = day;
  }
  if (d.type === d.original_type)
    for (const k of ["only_periods", "overrides", "when", "cycle"] as const)
      if (d.keep[k]) Object.assign(rule, { [k]: d.keep[k] });
  const extensions: Extension[] = [];
  for (const line of lines(d.extensions)) {
    const [period, due_date, reference] = line.split("|").map((x) => x.trim());
    if (!period || !reference || !/^\d{4}-\d{2}-\d{2}$/.test(due_date || ""))
      return fail(`Write extensions as "FY 2025-26 | 2026-11-21 | Circular": ${line}`);
    extensions.push({ period, due_date, reference });
  }
  if (extensions.length) {
    if (d.type === "event" || d.type === "incorporation")
      return fail("Extensions apply only to scheduled deadlines.");
    rule.extensions = extensions;
  }
  const official_references: Reference[] = [];
  for (const line of lines(d.references)) {
    const [label, url] = line.split("|").map((x) => x.trim());
    if (!label) return fail(`Each reference needs a label: ${line}`);
    if (url && !isSafeUrl(url))
      return fail(`Reference links must start with https:// — ${line}`);
    official_references.push(url ? { label, url } : { label });
  }
  if (!official_references.length) return fail("Add at least one official reference.");
  const applicability = conditionsApplicability(d.conditions);
  return {
    ok: true,
    value: {
      code,
      area: d.area,
      title: d.title.trim(),
      form_name: d.form_name.trim() || null,
      description: d.description.trim(),
      objective: d.objective.trim() || null,
      activity: d.activity.trim() || null,
      frequency: ruleTypes.find(([t]) => t === d.type)![2],
      deadline_rule: rule,
      deadline_text: d.deadline_text.trim(),
      required_documents: lines(d.documents),
      official_references,
      applicability,
      review_notes: d.review_notes.trim(),
      review_status: d.retired ? "Retired" : d.confirmed ? "Reviewed" : "Needs review",
    },
  };
}
export function conditionsApplicability(conditions: Record<string, Condition>) {
  const out: Applicability = {};
  for (const c of ["all", "any", "none"] as const) {
    const ks = factGroups
      .flatMap((g) => g.facts.map(([k]) => k))
      .filter((k) => conditions[k] === c);
    if (ks.length) out[c] = ks;
  }
  return out;
}
// Applicability lists in the catalogue order the template form saves.
export function orderedApplicability(app: Applicability): Applicability {
  const order = factGroups.flatMap((g) => g.facts.map(([k]) => k));
  const out: Applicability = {};
  for (const c of ["all", "any", "none"] as const)
    if (app[c]?.length)
      out[c] = [...app[c]!].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return out;
}
