"use client";
import { useState } from "react";
import { ArrowDownToLine, Printer } from "lucide-react";
import {
  type Task,
  type Company,
  type Profile,
  exportTasks,
  stats,
  todayISO,
  dateLabel,
  displayStatus,
} from "@/lib/model";
import WorkList, { emptyFilters, filterTasks } from "./work-list";
export default function Reports({
  tasks,
  companies,
  profiles,
  onOpen,
}: {
  tasks: Task[];
  companies: Company[];
  profiles: Profile[];
  onOpen: (t: Task) => void;
}) {
  const [filters, setFilters] = useState(emptyFilters),
    [period, setPeriod] = useState("all");
  const f = filterTasks(tasks, filters);
  const s = stats(f);
  function periodChange(v: string) {
    setPeriod(v);
    const d = todayISO();
    const y = d.slice(0, 4);
    const m = Number(d.slice(5, 7));
    let from = "",
      to = "";
    if (v === "month") {
      from = d.slice(0, 7) + "-01";
      to = new Date(Number(y), m, 0).toLocaleDateString("en-CA");
    }
    if (v === "quarter") {
      const start = Math.floor((m - 1) / 3) * 3 + 1;
      from = `${y}-${String(start).padStart(2, "0")}-01`;
      to = new Date(Number(y), start + 2, 0).toLocaleDateString("en-CA");
    }
    if (v === "year") {
      from = `${y}-01-01`;
      to = `${y}-12-31`;
    }
    setFilters({ ...filters, from, to });
  }
  return (
    <>
      <section className="panel report-summary">
        <div>
          <h2>Work report</h2>
          <p className="muted">
            {s.total} responsibilities · {s.completed} completed · {s.overdue}{" "}
            overdue · {s.percent}% complete
          </p>
        </div>
        <div className="button-row">
          <select
            aria-label="Reporting period"
            value={period}
            onChange={(e) => periodChange(e.target.value)}
          >
            <option value="all">All periods</option>
            <option value="month">This month</option>
            <option value="quarter">This quarter</option>
            <option value="year">This year</option>
          </select>
          <button
            className="button"
            onClick={() => exportTasks(f, companies, profiles)}
          >
            <ArrowDownToLine size={17} />
            Export CSV
          </button>
          <button className="button secondary" onClick={() => window.print()}>
            <Printer size={17} />
            Print / PDF
          </button>
        </div>
      </section>
      <p className="muted section-copy">
        Period filters use confirmed due dates. Work without a due date appears
        under “All periods”.
      </p>
      <div className="report-work-list">
        <WorkList
          tasks={tasks}
          companies={companies}
          profiles={profiles}
          admin
          filters={filters}
          setFilters={setFilters}
          onOpen={onOpen}
        />
      </div>
      <div className="print-report">
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Person</th>
              <th>Responsibility</th>
              <th>Frequency</th>
              <th>Due date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {f.map((t) => (
              <tr key={t.id}>
                <td>{companies.find((c) => c.id === t.company_id)?.name}</td>
                <td>
                  {profiles.find((p) => p.id === t.assigned_to)?.full_name}
                </td>
                <td>{t.particular}</td>
                <td>{t.frequency}</td>
                <td>{dateLabel(t.due_date)}</td>
                <td>{displayStatus(t)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="panel">
        <h2>Status distribution</h2>
        <div className="status-distribution">
          {[
            ["Completed", s.completed],
            ["In Progress", s.progress],
            ["Pending", s.pending],
            ["On Hold", s.hold],
            ["Overdue", s.overdue],
          ].map(([label, n]) => (
            <div
              key={label}
              style={{ flex: Number(n) || 0, display: n ? "block" : "none" }}
              className={
                "segment segment-" +
                String(label).toLowerCase().replaceAll(" ", "-")
              }
              title={`${label}: ${n}`}
            />
          ))}
        </div>
        <div className="status-legend">
          {[
            ["Completed", s.completed],
            ["In progress", s.progress],
            ["Pending", s.pending],
            ["On hold", s.hold],
            ["Overdue", s.overdue],
          ].map(([label, n]) => (
            <span key={label}>
              {label} <strong>{n}</strong>
            </span>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>Completion trend</h2>
        <div className="trend-chart">
          {Array.from({ length: 6 }, (_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - 5 + i);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            const n = tasks.filter(
              (t) =>
                t.status === "Completed" && t.completion_date?.startsWith(key),
            ).length;
            return (
              <div key={key}>
                <strong>{n}</strong>
                <div
                  className="trend-bar"
                  style={{ height: Math.max(3, Math.min(120, n * 12)) }}
                />
                <span>{d.toLocaleDateString("en-IN", { month: "short" })}</span>
              </div>
            );
          })}
        </div>
        <p className="muted">Completed responsibilities by completion month.</p>
      </section>
    </>
  );
}
