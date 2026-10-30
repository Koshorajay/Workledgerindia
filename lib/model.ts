import source from "@/data/preview.generated.json";
export type Status = "Pending" | "In Progress" | "Completed" | "On Hold";
export type Company = {
  id: string;
  name: string;
  code: string;
  active: boolean;
};
export type Profile = {
  id: string;
  auth_user_id: string;
  full_name: string;
  display_name: string;
  role: "admin" | "updater";
  active: boolean;
  username: string;
};
export type Task = {
  id: string;
  company_id: string;
  assigned_to: string;
  particular: string;
  objective: string | null;
  activity: string | null;
  category: string | null;
  frequency: string;
  documents_required: string | null;
  timeline_text: string | null;
  reporting_person: string | null;
  source_pdf_name: string | null;
  source_reference: string | null;
  source_company: string | null;
  status: Status;
  due_date: string | null;
  completion_date: string | null;
  remarks: string;
  review_flags: string[];
  review_required: boolean;
  period_label: string;
  template_key: string | null;
  compliance_template_id: string | null;
  created_at: string;
  updated_at: string;
};
export type History = {
  id: string;
  task_id: string;
  updated_by: string | null;
  old_status: string | null;
  new_status: string | null;
  old_remarks: string | null;
  new_remarks: string | null;
  update_note: string | null;
  created_at: string;
};
export type Attachment = {
  id: string;
  task_id: string;
  uploaded_by: string;
  file_name: string;
  storage_path: string;
  file_type: string;
  created_at: string;
};
export type Audit = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
};
export const statuses: Status[] = [
  "Pending",
  "In Progress",
  "Completed",
  "On Hold",
];
export const previewCompanies: Company[] = [
  { id: "company-1", name: "Ter___lt Tech", code: "TER", active: true },
  { id: "company-2", name: "Par__i", code: "PAR", active: true },
];
export const previewProfiles: Profile[] = [
  {
    id: "admin",
    username: "admin",
    auth_user_id: "",
    full_name: "Administrator",
    display_name: "Admin",
    role: "admin",
    active: true,
  },
  ...["Omprasanth", "Sasidharan", "CS"].map((n, i) => ({
    id: `person-${i + 1}`,
    username: n.toLowerCase(),
    auth_user_id: "",
    full_name: n,
    display_name: n,
    role: "updater" as const,
    active: true,
  })),
];
export type SourceRecord = {
  id: string;
  assigned_person: string;
  source_company: string;
  category: string | null;
  frequency: string;
  particular: string;
  objective: string | null;
  activity: string | null;
  documents_required: string | null;
  timeline_text: string | null;
  reporting_person: string | null;
  source_pdf_name: string;
  source_reference: string;
  review_flags: string[];
};
export const sourceRecords: SourceRecord[] = source;
export function createPreviewTasks(records: SourceRecord[]): Task[] {
  return previewCompanies.flatMap((c) =>
    records.map((r) => ({
      ...r,
      id: `${c.id}-${r.id}`,
      company_id: c.id,
      assigned_to: previewProfiles.find(
        (p) => p.full_name === r.assigned_person,
      )!.id,
      status: "Pending" as Status,
      due_date: null,
      completion_date: null,
      remarks: "",
      review_required: true,
      period_label: "Initial responsibility",
      template_key: r.id,
      compliance_template_id: null,
      created_at: "",
      updated_at: "",
    })),
  );
}
export const previewTasks = createPreviewTasks(sourceRecords);
export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function displayStatus(
  t: Pick<Task, "status" | "due_date">,
  today = todayISO(),
) {
  return t.status !== "Completed" && t.due_date && t.due_date < today
    ? "Overdue"
    : t.status;
}
export function stats(tasks: Task[]) {
  const completed = tasks.filter((t) => t.status === "Completed").length;
  return {
    total: tasks.length,
    completed,
    progress: tasks.filter((t) => displayStatus(t) === "In Progress").length,
    pending: tasks.filter((t) => displayStatus(t) === "Pending").length,
    overdue: tasks.filter((t) => displayStatus(t) === "Overdue").length,
    hold: tasks.filter((t) => displayStatus(t) === "On Hold").length,
    percent: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
  };
}
export function dateLabel(d: string | null) {
  return d
    ? new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(d.slice(0, 10) + "T12:00:00"))
    : "Date to be set";
}
export function csvCell(value: unknown) {
  let s = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function download(
  name: string,
  text: string,
  type = "text/csv;charset=utf-8",
) {
  const u = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
export function exportTasks(
  tasks: Task[],
  companies: Company[],
  profiles: Profile[],
) {
  const columns = [
    "Company",
    "Person",
    "Category",
    "Particular",
    "Objective",
    "Activity",
    "Documents required",
    "Frequency",
    "Timeline",
    "Due date",
    "Status",
    "Completion date",
    "Period",
    "Remarks",
    "Reporting person",
    "Source PDF",
    "Source reference",
    "Review required",
  ];
  download(
    "workledger-report.csv",
    [
      columns.map(csvCell).join(","),
      ...tasks.map((t) =>
        [
          companies.find((c) => c.id === t.company_id)?.name,
          profiles.find((p) => p.id === t.assigned_to)?.full_name,
          t.category,
          t.particular,
          t.objective,
          t.activity,
          t.documents_required,
          t.frequency,
          t.timeline_text,
          t.due_date,
          displayStatus(t),
          t.completion_date,
          t.period_label,
          t.remarks,
          t.reporting_person,
          t.source_pdf_name,
          t.source_reference,
          t.review_required ? "Yes" : "No",
        ]
          .map(csvCell)
          .join(","),
      ),
    ].join("\r\n"),
  );
}
