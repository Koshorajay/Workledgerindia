import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { templateSeed } from "../data/compliance-templates";
import { seedMigration, templateSeedSql } from "../lib/compliance-seed";
import {
  areas,
  checklistRows,
  draftPayload,
  emptyAnswers,
  factLabels,
  isSafeUrl,
  normalizeAnswers,
  answerWarnings,
  occurrences,
  orderedApplicability,
  previewTemplates,
  ruleTypes,
  suggestTemplates,
  templateDraft,
  templateTask,
  windowFor,
  type Answers,
  type ChecklistItem,
  type ComplianceTemplate,
  type DeadlineRule,
} from "../lib/compliance";
const today = "2026-10-24";
const answers = (a: Partial<Answers>): Answers => ({ ...emptyAnswers, ...a });
const tpl = (code: string) => {
  const t = previewTemplates.find((x) => x.code === code);
  assert.ok(t, code);
  return t;
};
const codes = (a: Answers) =>
  suggestTemplates(previewTemplates, a, today)
    .map((s) => s.template.code)
    .sort();
const due = (code: string, a: Answers, from: string, to: string) =>
  occurrences(tpl(code), a, from, to).map((o) => [o.period_label, o.due_date]);
const privateCo = answers({
  entity_type: "private",
  incorporation_date: "2015-04-01",
  gst_type: "regular",
  gst_filing: "monthly",
  gst_turnover: "above_5cr",
  tds_deductor: true,
  tds_salary: true,
  advance_tax: true,
  tax_audit: true,
  deposit_return: true,
  msme_dues: true,
});
test("starter library is complete, consistent and cites official https sources", async () => {
  assert.equal(templateSeed.length, 52);
  assert.equal(new Set(templateSeed.map((t) => t.code)).size, 52);
  for (const t of templateSeed) {
    assert.ok(areas.includes(t.area), t.code);
    assert.match(t.code, /^[A-Z0-9][A-Z0-9-]{1,47}$/);
    const type = ruleTypes.find(([, , f]) => f === t.frequency);
    assert.ok(type, t.code);
    assert.ok(
      {
        monthly: ["Monthly"],
        quarterly: ["Quarterly"],
        half_yearly: ["Half-yearly"],
        annual: ["Annually"],
        after_event: t.deadline_rule.event === "incorporation" ? ["One-time"] : ["Annually"],
        event: ["Event-based"],
      }[t.deadline_rule.kind].includes(t.frequency),
      `${t.code} frequency matches its rule`,
    );
    assert.ok(t.required_documents.length >= 2, `${t.code} documents`);
    assert.ok(t.official_references.length >= 1, `${t.code} references`);
    for (const r of t.official_references) {
      assert.ok(!r.label.includes("|"), `${t.code} reference label`);
      if (r.url) {
        assert.ok(isSafeUrl(r.url), r.url);
        assert.match(new URL(r.url).hostname, /(^|\.)gov\.in$/, r.url);
      }
    }
    assert.ok(t.official_references.some((r) => r.url), `${t.code} has a link`);
    const facts = [
      ...(t.applicability.all ?? []),
      ...(t.applicability.any ?? []),
      ...(t.applicability.none ?? []),
    ];
    for (const f of facts) assert.ok(factLabels[f], `${t.code} uses known fact ${f}`);
    assert.ok(
      (t.applicability.all?.length ?? 0) + (t.applicability.any?.length ?? 0) > 0,
      `${t.code} can be suggested`,
    );
    assert.equal(t.last_verified_on, "2026-10-24");
    assert.match(t.review_notes, /^Checked 24 Oct 2026/);
  }
  assert.ok(previewTemplates.every((t) => t.review_status === "Needs review"));
  assert.equal(
    await readFile(new URL(`../${seedMigration}`, import.meta.url), "utf8"),
    templateSeedSql(templateSeed),
    "Run npm run seed:templates after changing the library",
  );
});
test("the template form round-trips every starter template unchanged", () => {
  for (const t of previewTemplates) {
    const r = draftPayload(templateDraft(t));
    assert.ok(r.ok, t.code + (r.ok ? "" : r.error));
    const { review_notes, ...value } = r.value;
    assert.deepEqual(value, {
      code: t.code,
      area: t.area,
      title: t.title,
      form_name: t.form_name,
      description: t.description,
      objective: t.objective,
      activity: t.activity,
      frequency: t.frequency,
      deadline_rule: t.deadline_rule,
      deadline_text: t.deadline_text,
      required_documents: t.required_documents,
      official_references: t.official_references,
      applicability: orderedApplicability(t.applicability),
      review_status: "Needs review",
    });
    assert.equal(review_notes, t.review_notes);
  }
  const d = templateDraft(tpl("IT-TDS-PAY"));
  const reviewed = draftPayload({ ...d, confirmed: true });
  assert.ok(reviewed.ok && reviewed.value.review_status === "Reviewed");
  const bad = draftPayload({ ...d, references: "Portal | javascript:alert(1)" });
  assert.ok(!bad.ok && /https/.test(bad.error));
  const changed = draftPayload({ ...d, type: "quarterly" });
  assert.ok(changed.ok && !changed.value.deadline_rule.overrides, "special cases follow the rule type");
});
test("questionnaire answers suggest only the applicable templates, with reasons", () => {
  assert.deepEqual(codes(privateCo), [
    "GST-GSTR1-M",
    "GST-GSTR3B-M",
    "GST-GSTR9",
    "GST-GSTR9C",
    "IT-ADV-TAX",
    "IT-AUDIT-26",
    "IT-ITR-AUDIT",
    "IT-TDS-130",
    "IT-TDS-131",
    "IT-TDS-138",
    "IT-TDS-140",
    "IT-TDS-PAY",
    "ROC-ADT1",
    "ROC-AGM",
    "ROC-AOC4",
    "ROC-BOARD-Q",
    "ROC-DIR12",
    "ROC-DIR3KYC",
    "ROC-DPT3",
    "ROC-MBP1",
    "ROC-MGT14",
    "ROC-MGT7",
    "ROC-MSME1",
  ]);
  assert.deepEqual(
    suggestTemplates(previewTemplates, privateCo, today).find((s) => s.template.code === "GST-GSTR9")
      ?.reasons,
    ["GST regular taxpayer", "GST turnover above ₹2 crore"],
  );
  const llp = answers({
    entity_type: "llp",
    gst_type: "regular",
    gst_filing: "qrmp",
    gst_turnover: "upto_2cr",
    gstins: ["07ABCDE1234F1Z5"],
  });
  assert.deepEqual(codes(llp), [
    "GST-GSTR1-Q",
    "GST-GSTR3B-Q",
    "GST-PMT06",
    "IT-ITR-NONAUDIT",
    "LLP-FORM11",
    "LLP-FORM8",
    "ROC-DIR3KYC",
  ]);
  const opc = answers({
    entity_type: "opc",
    incorporation_date: "2026-06-01",
    gst_type: "composition",
    agm_month: 9,
    agm_day: 15,
  });
  assert.deepEqual(codes(opc), [
    "GST-CMP08",
    "GST-GSTR4",
    "IT-ITR-AUDIT",
    "ROC-ADT1",
    "ROC-AOC4-OPC",
    "ROC-BOARD-H",
    "ROC-DIR12",
    "ROC-DIR3KYC",
    "ROC-INC20A",
    "ROC-MBP1",
    "ROC-MGT14",
    "ROC-MGT7A",
  ]);
  assert.deepEqual(codes(answers({ entity_type: "proprietorship", gst_type: "none" })), [
    "IT-ITR-NONAUDIT",
  ]);
  assert.deepEqual(codes(emptyAnswers), []);
  const retired = previewTemplates.map((t) =>
    t.code === "GST-GSTR9" ? { ...t, review_status: "Retired" as const } : t,
  );
  assert.ok(!suggestTemplates(retired, privateCo, today).some((s) => s.template.code === "GST-GSTR9"));
});
test("deadline rules produce the statutory due dates", () => {
  assert.deepEqual(due("GST-GSTR1-M", privateCo, "2026-11-01", "2026-11-30"), [
    ["Oct 2026", "2026-11-11"],
  ]);
  const qrmp = (gstins: string[]) =>
    answers({ entity_type: "private", gst_type: "regular", gst_filing: "qrmp", gstins });
  assert.deepEqual(due("GST-GSTR3B-Q", qrmp(["27ABCDE1234F1Z5"]), "2026-10-01", "2026-10-31"), [
    ["Q2 FY 2026-27", "2026-10-22"],
  ]);
  assert.deepEqual(due("GST-GSTR3B-Q", qrmp(["07ABCDE1234F1Z5"]), "2026-10-01", "2026-10-31"), [
    ["Q2 FY 2026-27", "2026-10-24"],
  ]);
  assert.deepEqual(
    due("GST-GSTR3B-Q", qrmp(["07ABCDE1234F1Z5", "27ABCDE1234F2Z4"]), "2026-10-01", "2026-10-31"),
    [["Q2 FY 2026-27", "2026-10-22"]],
  );
  assert.deepEqual(
    due("GST-PMT06", qrmp([]), "2026-11-01", "2027-03-31").map(([p]) => p),
    ["Oct 2026", "Nov 2026", "Jan 2027", "Feb 2027"],
  );
  assert.deepEqual(due("IT-TDS-PAY", privateCo, "2027-03-01", "2027-04-30"), [
    ["Feb 2027", "2027-03-07"],
    ["Mar 2027", "2027-04-30"],
  ]);
  assert.deepEqual(due("IT-TDS-140", privateCo, "2026-06-01", "2027-06-30"), [
    ["Q1 FY 2026-27", "2026-07-31"],
    ["Q2 FY 2026-27", "2026-10-31"],
    ["Q3 FY 2026-27", "2027-01-31"],
    ["Q4 FY 2026-27", "2027-05-31"],
  ]);
  assert.deepEqual(due("IT-TDS-131", privateCo, "2026-08-01", "2027-06-30").map(([, d]) => d), [
    "2026-08-15",
    "2026-11-15",
    "2027-02-15",
    "2027-06-15",
  ]);
  assert.deepEqual(due("IT-ADV-TAX", privateCo, "2026-04-01", "2027-03-31").map(([, d]) => d), [
    "2026-06-15",
    "2026-09-15",
    "2026-12-15",
    "2027-03-15",
  ]);
  assert.deepEqual(due("ROC-MSME1", privateCo, "2026-10-01", "2027-04-30"), [
    ["H1 FY 2026-27", "2026-10-31"],
    ["H2 FY 2026-27", "2027-04-30"],
  ]);
  assert.deepEqual(due("ROC-PAS6", privateCo, "2026-10-01", "2027-05-31").map(([, d]) => d), [
    "2026-11-29",
    "2027-05-30",
  ]);
  const itr = occurrences(tpl("IT-ITR-AUDIT"), privateCo, "2026-10-01", "2027-12-31");
  assert.deepEqual(
    itr.map((o) => [o.period_label, o.due_date]),
    [
      ["FY 2025-26", "2026-11-21"],
      ["FY 2026-27", "2027-10-31"],
    ],
  );
  assert.match(itr[0].notes[0], /Circular No\. 7\/2026/);
  assert.deepEqual(due("IT-AUDIT-26", privateCo, "2026-09-01", "2026-12-31"), [
    ["FY 2025-26", "2026-10-21"],
  ]);
  const aoc4 = occurrences(tpl("ROC-AOC4"), privateCo, "2026-10-01", "2026-12-31");
  assert.deepEqual(aoc4.map((o) => o.due_date), ["2026-10-30"]);
  assert.match(aoc4[0].flags[0], /last date for the AGM/);
  const planned = answers({ ...privateCo, agm_month: 9, agm_day: 15 });
  assert.deepEqual(due("ROC-AOC4", planned, "2026-10-01", "2026-12-31"), [["FY 2025-26", "2026-10-15"]]);
  assert.deepEqual(due("ROC-MGT7", privateCo, "2026-10-01", "2026-12-31"), [["FY 2025-26", "2026-11-29"]]);
  const opc = answers({ entity_type: "opc", agm_month: 9, agm_day: 15 });
  assert.deepEqual(due("ROC-AOC4-OPC", opc, "2026-09-01", "2026-12-31"), [["FY 2025-26", "2026-09-27"]]);
  assert.deepEqual(due("ROC-MGT7A", opc, "2026-09-01", "2026-12-31"), [["FY 2025-26", "2026-11-29"]]);
  assert.deepEqual(
    due("ROC-DIR3KYC", answers({ entity_type: "private", dir3_kyc_year: 2028 }), "2026-01-01", "2031-12-31"),
    [
      ["FY 2027-28", "2028-06-30"],
      ["FY 2030-31", "2031-06-30"],
    ],
  );
  const yearly = occurrences(tpl("ROC-DIR3KYC"), privateCo, "2027-01-01", "2027-12-31");
  assert.equal(yearly.length, 1);
  assert.match(yearly[0].flags[0], /once every 3 years/);
  assert.deepEqual(
    due("ROC-ADT1", answers({ ...privateCo, auditor_appointment_year: 2026 }), "2026-01-01", "2027-12-31"),
    [["FY 2025-26", "2026-10-15"]],
  );
  assert.deepEqual(due("ROC-BOARD-H", answers({ entity_type: "opc" }), "2026-01-01", "2026-12-31"), [
    ["H1 2026", "2026-06-30"],
    ["H2 2026", "2026-12-31"],
  ]);
  const newCo = answers({ entity_type: "private", incorporation_date: "2026-08-10" });
  assert.deepEqual(
    due("GST-GSTR1-M", newCo, "2026-08-01", "2026-12-31").map(([p]) => p),
    ["Aug 2026", "Sep 2026", "Oct 2026", "Nov 2026"],
  );
  assert.deepEqual(due("ROC-INC20A", answers({ entity_type: "private", incorporation_date: "2026-06-01" }), "2026-10-01", "2026-12-31"), [
    ["One-time", "2026-11-28"],
  ]);
  const event = occurrences(tpl("ROC-MBP1"), privateCo, "2026-10-01", "2027-03-31");
  assert.deepEqual(event.map((o) => [o.period_label, o.due_date]), [["FY 2026-27 (as required)", null]]);
  assert.match(event[0].flags[0], /first Board meeting/);
  const febRule: DeadlineRule = { kind: "monthly", months_after: 1, day: 30 };
  assert.deepEqual(
    occurrences({ deadline_rule: febRule }, privateCo, "2027-02-01", "2028-02-29")
      .filter((o) => o.period_label.startsWith("Jan"))
      .map((o) => o.due_date),
    ["2027-02-28", "2028-02-29"],
  );
  const calendarCo = answers({ entity_type: "private", fy_start_month: 1 });
  assert.deepEqual(due("ROC-AGM", calendarCo, "2027-01-01", "2027-12-31"), [["FY 2026", "2027-06-30"]]);
  assert.deepEqual(windowFor("month", today), { from: "2026-10-01", to: "2026-10-31" });
  assert.deepEqual(windowFor("quarter", today), { from: "2026-10-01", to: "2026-12-31" });
  assert.deepEqual(windowFor("fy", today), { from: "2026-10-01", to: "2027-03-31" });
  assert.deepEqual(windowFor("fy", "2027-04-05"), { from: "2027-04-01", to: "2028-03-31" });
});
test("responsibilities created from templates keep the link, period and review flags", () => {
  const [aoc4] = occurrences(tpl("ROC-AOC4"), privateCo, "2026-10-01", "2026-12-31");
  const t = templateTask(tpl("ROC-AOC4"), aoc4, "company-1", "person-1", " Madhusudan ");
  assert.equal(t.template_key, "tpl:ROC-AOC4");
  assert.equal(t.compliance_template_id, "ROC-AOC4");
  assert.equal(t.category, "Company / ROC");
  assert.equal(t.period_label, "FY 2025-26");
  assert.equal(t.due_date, "2026-10-30");
  assert.equal(t.reporting_person, "Madhusudan");
  assert.equal(t.status, "Pending");
  assert.equal(t.review_required, true);
  assert.deepEqual(t.review_flags, aoc4.flags);
  assert.match(t.documents_required ?? "", /Auditor's report/);
  const [gstr1] = occurrences(tpl("GST-GSTR1-M"), privateCo, "2026-11-01", "2026-11-30");
  const g = templateTask(tpl("GST-GSTR1-M"), gstr1, "company-1", "person-1", "");
  assert.equal(g.review_required, false);
  assert.equal(g.reporting_person, null);
  assert.equal(g.source_reference, "Compliance library: GST-GSTR1-M");
  const [itr] = occurrences(tpl("IT-ITR-AUDIT"), privateCo, "2026-11-01", "2026-11-30");
  assert.match(templateTask(tpl("IT-ITR-AUDIT"), itr, "c", "p", "").source_reference ?? "", /Extended from/);
});
test("answers are normalised and checked for common identifier mistakes", () => {
  const a = normalizeAnswers({
    entity_type: "bogus",
    gstins: [" 27abcde1234f1z5 ", ""],
    fy_start_month: "13",
    agm_month: "9",
    small_company: "yes",
    pan: "ABCDE1234F",
    unknown: true,
  });
  assert.equal(a.entity_type, "");
  assert.deepEqual(a.gstins, ["27ABCDE1234F1Z5"]);
  assert.equal(a.fy_start_month, 4);
  assert.equal(a.agm_month, 9);
  assert.equal(a.small_company, false);
  assert.ok(!("unknown" in a));
  assert.deepEqual(normalizeAnswers(undefined), emptyAnswers);
  assert.deepEqual(answerWarnings(a), []);
  const w = answerWarnings(
    answers({ pan: "ABCDE1234F", gstins: ["27ZZZZZ9999Z1Z5", "BAD"], gst_type: "regular", gst_filing: "qrmp", gst_turnover: "above_5cr" }),
  );
  assert.equal(w.length, 3);
});
test("checklist rows combine suggestions, earlier decisions and manual additions", () => {
  const item = (template_id: string, status: ChecklistItem["status"]): ChecklistItem => ({
    id: template_id,
    company_id: "company-1",
    template_id,
    status,
    origin: "Suggested",
    reasons: ["Earlier reason"],
    note: "",
    default_assignee: null,
    reviewed_by: null,
    reviewed_at: "",
    created_at: "",
    updated_at: "",
  });
  const rows = checklistRows(
    previewTemplates,
    privateCo,
    [item("GST-GSTR9", "Excluded"), item("LLP-FORM8", "Active")],
    ["IT-SFT-165", "GST-GSTR1-M"],
    today,
  );
  assert.equal(rows.length, 25);
  const find = (code: string) => rows.find((r) => r.template.code === code)!;
  assert.equal(find("GST-GSTR9").item?.status, "Excluded");
  assert.equal(find("GST-GSTR9").suggested, true);
  assert.equal(find("LLP-FORM8").suggested, false);
  assert.deepEqual(find("LLP-FORM8").reasons, ["Earlier reason"]);
  assert.equal(find("IT-SFT-165").origin, "Added manually");
  assert.equal(find("GST-GSTR1-M").origin, "Suggested");
  const order = rows.map((r: { template: ComplianceTemplate }) => r.template.area);
  assert.deepEqual(order, [...order].sort((x, y) => areas.indexOf(x) - areas.indexOf(y)));
});
