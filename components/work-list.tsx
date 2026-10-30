"use client";
import { useState } from "react";
import {
  Search,
  SlidersHorizontal,
  CalendarDays,
  ChevronRight,
  TriangleAlert,
} from "lucide-react";
import {
  dateLabel,
  displayStatus,
  type Task,
  type Company,
  type Profile,
} from "@/lib/model";
import { Badge, Empty } from "./ui";
export type Filters = {
  search: string;
  person: string;
  frequency: string;
  status: string;
  from: string;
  to: string;
  review: boolean;
};
export const emptyFilters: Filters = {
  search: "",
  person: "all",
  frequency: "all",
  status: "all",
  from: "",
  to: "",
  review: false,
};
export function filterTasks(tasks: Task[], f: Filters) {
  return tasks.filter(
    (t) =>
      (!f.search ||
        [t.particular, t.objective, t.activity, t.remarks, t.category, t.period_label]
          .join(" ")
          .toLowerCase()
          .includes(f.search.toLowerCase())) &&
      (f.person === "all" || t.assigned_to === f.person) &&
      (f.frequency === "all" || t.frequency === f.frequency) &&
      (f.status === "all" || displayStatus(t) === f.status) &&
      (!f.from || (!!t.due_date && t.due_date >= f.from)) &&
      (!f.to || (!!t.due_date && t.due_date <= f.to)) &&
      (!f.review || t.review_required),
  );
}
export default function WorkList({
  tasks,
  companies,
  profiles,
  admin,
  filters,
  setFilters,
  onOpen,
}: {
  tasks: Task[];
  companies: Company[];
  profiles: Profile[];
  admin: boolean;
  filters: Filters;
  setFilters: (f: Filters) => void;
  onOpen: (t: Task) => void;
}) {
  const [page, setPage] = useState(0),
    [sort, setSort] = useState("name"),
    [expanded, setExpanded] = useState(false);
  const filtered = filterTasks(tasks, filters).sort((a, b) =>
    sort === "due"
      ? (a.due_date || "9999").localeCompare(b.due_date || "9999")
      : sort === "updated"
        ? b.updated_at.localeCompare(a.updated_at)
        : a.particular.localeCompare(b.particular),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / 12));
  const current = Math.min(page, totalPages - 1);
  const rows = filtered.slice(current * 12, current * 12 + 12);
  const change = (k: keyof Filters, v: string | boolean) => {
    setPage(0);
    setFilters({ ...filters, [k]: v });
  };
  return (
    <>
      <div className="work-filter-panel">
        <div className="search-row">
          <label className="search-box">
            <Search size={19} />
            <input
              aria-label="Search work"
              placeholder="Search responsibilities…"
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
          <select
            aria-label="Sort work"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="name">Name A–Z</option>
            <option value="due">Due date</option>
            <option value="updated">Recently updated</option>
          </select>
        </div>
        <div className={"filters " + (expanded ? "expanded" : "")}>
          {admin && (
            <label>
              Person
              <select
                value={filters.person}
                onChange={(e) => change("person", e.target.value)}
              >
                <option value="all">All people</option>
                {profiles
                  .filter((p) => p.role === "updater")
                  .map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.full_name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <label>
            Status
            <select
              value={filters.status}
              onChange={(e) => change("status", e.target.value)}
            >
              <option value="all">All statuses</option>
              {[
                "Pending",
                "In Progress",
                "Completed",
                "On Hold",
                "Overdue",
              ].map((s) => (
                <option key={s}>{s}</option>
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
              {Array.from(new Set(tasks.map((t) => t.frequency))).map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <label>
            Due from
            <input
              type="date"
              value={filters.from}
              onChange={(e) => change("from", e.target.value)}
            />
          </label>
          <label>
            Due to
            <input
              type="date"
              value={filters.to}
              onChange={(e) => change("to", e.target.value)}
            />
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
        {admin && (
          <label className="check-field filter-review">
            <input
              type="checkbox"
              checked={filters.review}
              onChange={(e) => change("review", e.target.checked)}
            />
            Needs source review{" "}
            <span className="count-pill">
              {tasks.filter((t) => t.review_required).length}
            </span>
          </label>
        )}
      </div>
      <div className="results-label">
        <span>{filtered.length} responsibilities</span>
        <span>
          {current * 12 + 1 > filtered.length ? 0 : current * 12 + 1}–
          {Math.min((current + 1) * 12, filtered.length)} of {filtered.length}
        </span>
      </div>
      {filtered.length ? (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Responsibility</th>
                  <th>Company / person</th>
                  <th>Frequency</th>
                  <th>Due date</th>
                  <th>Status</th>
                  <th>Last updated</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <button className="task-name" onClick={() => onOpen(t)}>
                        {t.particular}
                      </button>
                      <small>{t.category || t.objective || t.activity}</small>
                      {t.review_required && (
                        <span className="review-label">
                          Source review needed
                        </span>
                      )}
                    </td>
                    <td>
                      <span>
                        {companies.find((c) => c.id === t.company_id)?.name}
                      </span>
                      <small>
                        {
                          profiles.find((p) => p.id === t.assigned_to)
                            ?.full_name
                        }
                      </small>
                    </td>
                    <td>
                      {t.frequency}
                      <small>{t.timeline_text}</small>
                    </td>
                    <td className={!t.due_date ? "muted" : ""}>
                      {dateLabel(t.due_date)}
                      <small>{t.period_label}</small>
                    </td>
                    <td>
                      <Badge status={displayStatus(t)} />
                    </td>
                    <td>
                      {t.updated_at ? dateLabel(t.updated_at) : "No updates"}
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={"Open " + t.particular}
                        onClick={() => onOpen(t)}
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
              <button
                className="task-card"
                key={t.id}
                onClick={() => onOpen(t)}
              >
                <div className="task-card-top">
                  <span>
                    {companies.find((c) => c.id === t.company_id)?.name}
                  </span>
                  <Badge status={displayStatus(t)} />
                </div>
                <h3>{t.particular}</h3>
                <p>
                  {t.objective || t.activity || "View responsibility details"}
                </p>
                <div className="task-card-meta">
                  <span>
                    {profiles.find((p) => p.id === t.assigned_to)?.full_name}
                  </span>
                  <span>{t.frequency}</span>
                </div>
                <div className="task-card-bottom">
                  <span>
                    <CalendarDays size={16} />
                    {dateLabel(t.due_date)} · {t.period_label}
                  </span>
                  {t.review_required ? (
                    <span className="review-label">
                      <TriangleAlert size={14} />
                      Review
                    </span>
                  ) : (
                    <ChevronRight size={18} />
                  )}
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
          <Empty
            title="No work matches these filters"
            body="Change filters."
          />
        </section>
      )}
    </>
  );
}
