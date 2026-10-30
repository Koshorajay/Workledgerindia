"use client";
import { useState, type ReactNode } from "react";
import { Save, ArrowRight } from "lucide-react";
import { Field } from "./ui";
import { todayISO, type Profile } from "@/lib/model";
import {
  answerWarnings,
  companyTypes,
  entityTypes,
  monthNames,
  type Answers,
  type CompanyProfile,
} from "@/lib/compliance";
function Check({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="check-field field-wide">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}
const num = (v: string) => (v === "" ? null : Number(v));
export default function Questionnaire({
  answers,
  onChange,
  saved,
  profiles,
  dirty,
  preview,
  busy,
  error,
  onSave,
  onNext,
}: {
  answers: Answers;
  onChange: (a: Answers) => void;
  saved?: CompanyProfile;
  profiles: Profile[];
  dirty: boolean;
  preview: boolean;
  busy: boolean;
  error: string;
  onSave: () => void;
  onNext: () => void;
}) {
  const [gstinText, setGstinText] = useState(answers.gstins.join("\n"));
  const set = <K extends keyof Answers>(k: K, v: Answers[K]) => onChange({ ...answers, [k]: v });
  const company = companyTypes.includes(answers.entity_type);
  const warnings = answerWarnings(answers);
  const savedBy = profiles.find((p) => p.id === saved?.updated_by)?.full_name;
  return (
    <form
      className="questionnaire"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      {preview && (
        <div className="notice">
          Preview: answers stay on this page and are not saved.
        </div>
      )}
      <section className="panel">
        <h2>Entity</h2>
        <p className="muted section-copy">
          These answers decide which GST, income-tax and company law templates are
          suggested. Nothing is activated until you review the checklist.
        </p>
        <div className="form-grid">
          <Field label="Company type">
            <select
              required
              value={answers.entity_type}
              onChange={(e) => set("entity_type", e.target.value as Answers["entity_type"])}
            >
              <option value="">Choose type</option>
              {entityTypes.map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date of incorporation or registration">
            <input
              type="date"
              max={todayISO()}
              value={answers.incorporation_date}
              onChange={(e) => set("incorporation_date", e.target.value)}
            />
          </Field>
          <Field label={answers.entity_type === "llp" ? "LLPIN" : "CIN or registration number"}>
            <input
              autoCapitalize="characters"
              spellCheck={false}
              value={answers.registration_number}
              onChange={(e) => set("registration_number", e.target.value.toUpperCase())}
            />
          </Field>
          <Field label="Financial year">
            <select
              value={answers.fy_start_month}
              onChange={(e) => set("fy_start_month", Number(e.target.value))}
            >
              {monthNames.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}–{monthNames[(i + 11) % 12]}
                  {i === 3 ? " (standard)" : ""}
                </option>
              ))}
            </select>
          </Field>
          {answers.entity_type === "private" && (
            <Check checked={answers.small_company} onChange={(v) => set("small_company", v)}>
              Small company: paid-up capital up to ₹10 crore and turnover up to ₹100
              crore, and not a holding or subsidiary company (limits from 1 Dec 2025)
            </Check>
          )}
        </div>
        {answers.fy_start_month !== 4 && (
          <p className="muted">
            A different financial year changes Companies Act dates only. GST and
            income-tax periods always run April–March.
          </p>
        )}
      </section>
      <section className="panel">
        <h2>Registrations</h2>
        <div className="form-grid">
          <Field label="PAN">
            <input
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={10}
              pattern="[A-Z]{5}[0-9]{4}[A-Z]"
              placeholder="ABCDE1234F"
              value={answers.pan}
              onChange={(e) => set("pan", e.target.value.toUpperCase().trim())}
            />
          </Field>
          <Field label="TAN">
            <input
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={10}
              pattern="[A-Z]{4}[0-9]{5}[A-Z]"
              placeholder="ABCD12345E"
              value={answers.tan}
              onChange={(e) => set("tan", e.target.value.toUpperCase().trim())}
            />
          </Field>
          <Field label="GSTINs (one per line)" wide>
            <textarea
              rows={2}
              spellCheck={false}
              value={gstinText}
              placeholder="27ABCDE1234F1Z5"
              onChange={(e) => {
                setGstinText(e.target.value.toUpperCase());
                set("gstins", e.target.value.toUpperCase().split(/\s+/).filter(Boolean));
              }}
            />
          </Field>
        </div>
      </section>
      <section className="panel">
        <h2>GST</h2>
        <div className="form-grid">
          <Field label="GST registration">
            <select
              value={answers.gst_type}
              onChange={(e) => set("gst_type", e.target.value as Answers["gst_type"])}
            >
              <option value="">Choose</option>
              <option value="none">Not registered</option>
              <option value="regular">Regular taxpayer</option>
              <option value="composition">Composition scheme</option>
            </select>
          </Field>
          {answers.gst_type === "regular" && (
            <>
              <Field label="Return filing">
                <select
                  value={answers.gst_filing}
                  onChange={(e) => set("gst_filing", e.target.value as Answers["gst_filing"])}
                >
                  <option value="monthly">Monthly GSTR-1 and GSTR-3B</option>
                  <option value="qrmp">Quarterly (QRMP scheme)</option>
                </select>
              </Field>
              <Field label="Aggregate turnover, previous year">
                <select
                  value={answers.gst_turnover}
                  onChange={(e) => set("gst_turnover", e.target.value as Answers["gst_turnover"])}
                >
                  <option value="">Choose</option>
                  <option value="upto_2cr">Up to ₹2 crore</option>
                  <option value="2_to_5cr">Above ₹2 crore, up to ₹5 crore</option>
                  <option value="above_5cr">Above ₹5 crore</option>
                </select>
              </Field>
            </>
          )}
          {answers.gst_type === "regular" && (
            <Check checked={answers.gst_job_work} onChange={(v) => set("gst_job_work", v)}>
              Sends inputs or capital goods to job workers (ITC-04)
            </Check>
          )}
          <Check checked={answers.gst_isd} onChange={(v) => set("gst_isd", v)}>
            Has an Input Service Distributor registration (GSTR-6)
          </Check>
          <Check checked={answers.gst_tds} onChange={(v) => set("gst_tds", v)}>
            Registered to deduct GST TDS (GSTR-7)
          </Check>
          <Check checked={answers.gst_ecommerce_tcs} onChange={(v) => set("gst_ecommerce_tcs", v)}>
            E-commerce operator collecting GST TCS (GSTR-8)
          </Check>
        </div>
      </section>
      <section className="panel">
        <h2>Income tax</h2>
        <div className="form-grid">
          <Check
            checked={answers.tds_deductor}
            onChange={(v) =>
              onChange({
                ...answers,
                tds_deductor: v,
                tds_salary: v && answers.tds_salary,
                tds_non_resident: v && answers.tds_non_resident,
              })
            }
          >
            Deducts tax at source (TDS)
          </Check>
          {answers.tds_deductor && (
            <div className="sub-checks field-wide">
              <Check checked={answers.tds_salary} onChange={(v) => set("tds_salary", v)}>
                On salaries (Form 138 and Form 130)
              </Check>
              <Check
                checked={answers.tds_non_resident}
                onChange={(v) => set("tds_non_resident", v)}
              >
                On payments to non-residents (Form 144)
              </Check>
            </div>
          )}
          <Check checked={answers.tcs_collector} onChange={(v) => set("tcs_collector", v)}>
            Collects tax at source (TCS)
          </Check>
          <Check checked={answers.advance_tax} onChange={(v) => set("advance_tax", v)}>
            Expects tax of ₹10,000 or more for the year (advance tax)
          </Check>
          <Check checked={answers.tax_audit} onChange={(v) => set("tax_audit", v)}>
            Accounts need a tax audit (Form 26, earlier Forms 3CA/3CB-3CD)
          </Check>
          <Check checked={answers.transfer_pricing} onChange={(v) => set("transfer_pricing", v)}>
            Has international or specified domestic transactions (Form 48 transfer
            pricing report)
          </Check>
          <Check checked={answers.sft_reporting} onChange={(v) => set("sft_reporting", v)}>
            Must file a statement of specified financial transactions (Form 165)
          </Check>
        </div>
        {company && (
          <p className="muted">
            Companies file their return by the audit-case date even without a tax
            audit.
          </p>
        )}
      </section>
      {(company || answers.entity_type === "llp") && (
        <section className="panel">
          <h2>{company ? "Company law" : "LLP law"}</h2>
          <div className="form-grid">
            {company && answers.entity_type !== "opc" && (
              <>
                <Field label="Planned AGM month">
                  <select
                    value={answers.agm_month ?? ""}
                    onChange={(e) => set("agm_month", num(e.target.value))}
                  >
                    <option value="">Use the last permitted date</option>
                    {monthNames.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Planned AGM day">
                  <input
                    type="number"
                    min={1}
                    max={31}
                    disabled={answers.agm_month === null}
                    required={answers.agm_month !== null}
                    value={answers.agm_day ?? ""}
                    onChange={(e) => set("agm_day", num(e.target.value))}
                  />
                </Field>
              </>
            )}
            {company && (
              <Field label="Year of the next auditor appointment">
                <input
                  type="number"
                  min={2000}
                  max={2100}
                  placeholder="e.g. 2029"
                  value={answers.auditor_appointment_year ?? ""}
                  onChange={(e) => set("auditor_appointment_year", num(e.target.value))}
                />
              </Field>
            )}
            <Field label="Year the next DIR-3 KYC is due (by 30 June)">
              <input
                type="number"
                min={2000}
                max={2100}
                placeholder="e.g. 2028"
                value={answers.dir3_kyc_year ?? ""}
                onChange={(e) => set("dir3_kyc_year", num(e.target.value))}
              />
            </Field>
            {company && (
              <>
                <Check checked={answers.deposit_return} onChange={(v) => set("deposit_return", v)}>
                  Has loans or other money received to report in DPT-3, including
                  exempted deposits
                </Check>
                <Check checked={answers.msme_dues} onChange={(v) => set("msme_dues", v)}>
                  Owes micro or small enterprise suppliers for more than 45 days (MSME-1)
                </Check>
                <Check checked={answers.pas6} onChange={(v) => set("pas6", v)}>
                  Must file PAS-6 share capital reconciliation (unlisted public
                  company, or private company that is not a small company)
                </Check>
                <Check checked={answers.csr} onChange={(v) => set("csr", v)}>
                  Corporate social responsibility (section 135) applies
                </Check>
                <Check checked={answers.xbrl} onChange={(v) => set("xbrl", v)}>
                  Files financial statements in XBRL
                </Check>
                <Check checked={answers.subsidiaries} onChange={(v) => set("subsidiaries", v)}>
                  Has subsidiaries, associates or joint ventures (consolidated accounts)
                </Check>
              </>
            )}
          </div>
          <p className="muted">
            Leave the year fields blank if unknown; those items will then be flagged
            for confirmation each year.
          </p>
        </section>
      )}
      <section className="panel">
        <Field label="Notes for the reviewer" wide>
          <textarea rows={2} value={answers.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </section>
      {warnings.length > 0 && (
        <div className="review-notice">
          <strong>Check these answers</strong>
          <ul>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="setup-footer">
        <p className="muted">
          {saved
            ? `Saved${savedBy ? ` by ${savedBy}` : ""} on ${new Date(saved.updated_at).toLocaleString("en-IN")}.`
            : "Not saved yet."}
          {saved && dirty ? " You have unsaved changes." : ""}
        </p>
        <div className="button-row">
          <button className="button secondary" disabled={busy || preview || !dirty}>
            <Save size={16} />
            {busy ? "Saving…" : "Save questionnaire"}
          </button>
          <button type="button" className="button" onClick={onNext}>
            Review checklist
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </form>
  );
}
