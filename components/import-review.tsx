"use client";
import { useState } from "react";
import Papa from "papaparse";
import { Upload, FileJson, CheckCheck } from "lucide-react";
import { sourceRecords, type Company, type Profile } from "@/lib/model";
import { supabase } from "@/lib/supabase";
import { Field } from "./ui";
type Row = {
  company_id: string;
  assigned_to: string;
  particular: string;
  objective: string;
  activity: string;
  frequency: string;
  timeline_text: string;
  reporting_person: string;
  documents_required: string;
  category: string;
  source_pdf_name: string;
  source_reference: string;
  source_company: string;
  template_key: string;
  period_label: string;
  due_date: string | null;
  review_flags: string[];
  review_required: boolean;
};
export default function ImportReview({
  companies,
  profiles,
  preview,
  onSaved,
}: {
  companies: Company[];
  profiles: Profile[];
  preview: boolean;
  onSaved: (s: string) => void;
}) {
  const [rows, setRows] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [company, setCompany] = useState("both"),
    [page, setPage] = useState(0);
  function stage(records: Record<string, unknown>[]) {
    setError("");
    setConfirmed(false);
    setPage(0);
    const targets =
      company === "both"
        ? companies.filter((c) => c.active)
        : companies.filter((c) => c.id === company);
    if (!targets.length) {
      setError("Choose at least one active company.");
      return;
    }
    setRows(
      records.flatMap((r, i) =>
        targets.map((c) => ({
          company_id: c.id,
          assigned_to:
            profiles.find(
              (p) =>
                p.role === "updater" &&
                p.active &&
                (p.id === r.assigned_to || p.full_name === r.assigned_person),
            )?.id || "",
          particular: String(r.particular || ""),
          objective: String(r.objective || ""),
          activity: String(r.activity || ""),
          frequency: String(r.frequency || ""),
          timeline_text: String(r.timeline_text || ""),
          reporting_person: String(r.reporting_person || ""),
          documents_required: String(r.documents_required || ""),
          category: String(r.category || ""),
          source_pdf_name: String(r.source_pdf_name || ""),
          source_reference: String(r.source_reference || ""),
          source_company: String(r.source_company || ""),
          template_key: String(
            r.template_key || r.id || `import-${crypto.randomUUID()}-${i}`,
          ),
          period_label: String(r.period_label || "Initial responsibility"),
          due_date: null,
          review_flags: Array.isArray(r.review_flags)
            ? r.review_flags.map(String)
            : [],
          review_required: true,
        })),
      ),
    );
  }
  async function read(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      setError("Choose a JSON or CSV file smaller than 2 MB.");
      return;
    }
    try {
      const text = await file.text();
      let data: unknown;
      if (file.name.toLowerCase().endsWith(".json")) data = JSON.parse(text);
      else if (file.name.toLowerCase().endsWith(".csv")) {
        const p = Papa.parse<Record<string, unknown>>(text, {
          header: true,
          skipEmptyLines: "greedy",
        });
        if (p.errors.length) throw new Error(p.errors[0].message);
        data = p.data;
      } else
        throw new Error(
          "Use JSON or CSV. Convert and review PDF data before importing.",
        );
      if (
        !Array.isArray(data) ||
        !data.length ||
        data.length > 1000 ||
        data.some((r) => typeof r !== "object" || !r)
      )
        throw new Error("The import must contain 1–1,000 records.");
      stage(data as Record<string, unknown>[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to read import");
    }
  }
  const update = (index: number, key: keyof Row, v: unknown) => {
    setConfirmed(false);
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, [key]: v } : r)));
  };
  async function importRows() {
    if (!supabase || preview) return;
    setBusy(true);
    setError("");
    try {
      if (
        rows.some(
          (r) =>
            !r.particular.trim() ||
            !r.frequency.trim() ||
            !r.assigned_to ||
            !r.company_id ||
            !r.period_label.trim(),
        )
      )
        throw new Error(
          "Every record needs a company, person, particular, frequency and period.",
        );
      const { error } = await supabase
        .from("tasks")
        .insert(
          rows.map((r) => ({
            ...r,
            status: "Pending",
            remarks: "",
            completion_date: null,
          })),
        );
      if (error)
        throw new Error(
          error.code === "23505"
            ? "These source responsibilities have already been imported for this company and period. Change the period for a new occurrence."
            : error.message,
        );
      onSaved(`${rows.length} responsibilities imported.`);
      setRows([]);
      setConfirmed(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="panel">
        <h2>Import & review</h2>
        <p className="muted section-copy">
          Import your prepared JSON or CSV, check the extracted wording, then
          confirm. PDF extraction is kept separate so uncertain text is never
          silently imported.
        </p>
        <div className="import-toolbar">
          <Field label="Apply imported responsibilities to">
            <select
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            >
              <option value="both">Both active companies</option>
              {companies
                .filter((c) => c.active)
                .map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </Field>
          <button
            className="button secondary"
            disabled={!sourceRecords.length}
            onClick={() => stage(sourceRecords)}
          >
            <FileJson size={17} />
            Load 37 source responsibilities
          </button>
          <label className="button secondary">
            <Upload size={17} />
            Upload JSON / CSV
            <input
              className="sr-only"
              type="file"
              accept=".json,.csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void read(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <p className="muted">
          The original company name and PDF row references are preserved. All
          imported due dates start unset.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>
      {rows.length > 0 && (
        <section className="panel">
          <div className="panel-heading">
            <h2>{rows.length} records to review</h2>
            <span className="muted">
              Page {page + 1} of {Math.ceil(rows.length / 10)}
            </span>
          </div>
          {rows.slice(page * 10, page * 10 + 10).map((r, j) => {
            const i = page * 10 + j;
            return (
              <details className="import-record" key={i}>
                <summary>
                  <span>
                    <strong>
                      {i + 1}. {r.particular || "Untitled record"}
                    </strong>
                    <small>
                      {companies.find((c) => c.id === r.company_id)?.name} ·{" "}
                      {profiles.find((p) => p.id === r.assigned_to)
                        ?.full_name || "Person required"}
                    </small>
                  </span>
                  <span className="badge badge-pending">Review</span>
                </summary>
                <div className="form-grid">
                  <Field label="Company">
                    <select
                      value={r.company_id}
                      onChange={(e) => update(i, "company_id", e.target.value)}
                    >
                      {companies.map((c) => (
                        <option value={c.id} key={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Person">
                    <select
                      value={r.assigned_to}
                      onChange={(e) => update(i, "assigned_to", e.target.value)}
                    >
                      <option value="">Choose person</option>
                      {profiles
                        .filter((p) => p.role === "updater" && p.active)
                        .map((p) => (
                          <option value={p.id} key={p.id}>
                            {p.full_name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  {(
                    [
                      "particular",
                      "objective",
                      "activity",
                      "frequency",
                      "timeline_text",
                      "reporting_person",
                      "documents_required",
                      "category",
                      "period_label",
                    ] as const
                  ).map((k) => (
                    <Field
                      label={k.replaceAll("_", " ")}
                      key={k}
                      wide={["particular", "objective", "activity"].includes(k)}
                    >
                      <input
                        value={r[k]}
                        onChange={(e) => update(i, k, e.target.value)}
                      />
                    </Field>
                  ))}
                  <Field label="Confirmed due date">
                    <input
                      type="date"
                      value={r.due_date || ""}
                      onChange={(e) =>
                        update(i, "due_date", e.target.value || null)
                      }
                    />
                  </Field>
                  <label className="check-field field-wide">
                    <input
                      type="checkbox"
                      checked={!r.review_required}
                      onChange={(e) =>
                        update(i, "review_required", !e.target.checked)
                      }
                    />
                    Source ambiguity resolved for this record
                  </label>
                </div>
                {r.review_flags.length > 0 && (
                  <ul className="review-flags">
                    {r.review_flags.map((f, k) => (
                      <li key={k}>{f}</li>
                    ))}
                  </ul>
                )}
                <p className="source-reference">
                  {r.source_reference || "Imported record"}
                </p>
              </details>
            );
          })}
          <div className="pagination">
            <button
              className="button secondary"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <button
              className="button secondary"
              disabled={(page + 1) * 10 >= rows.length}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
          <label className="check-field">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I confirm the company and person assignments. Unresolved records
            will remain flagged for admin review.
          </label>
          {preview && (
            <p className="notice">
              Connect Supabase to import these reviewed records.
            </p>
          )}
          <button
            className="button"
            disabled={!confirmed || busy || preview}
            onClick={() => void importRows()}
          >
            <CheckCheck size={17} />
            {busy ? "Importing…" : `Confirm ${rows.length} records`}
          </button>
        </section>
      )}
    </>
  );
}
