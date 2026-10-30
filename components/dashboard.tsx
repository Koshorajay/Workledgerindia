"use client";
import {
  ClipboardList,
  CircleCheck,
  Clock3,
  CircleDashed,
  TriangleAlert,
  Building2,
  ChevronRight,
} from "lucide-react";
import {
  stats,
  dateLabel,
  displayStatus,
  todayISO,
  type Task,
  type Profile,
  type Company,
} from "@/lib/model";
import { Badge, Empty } from "./ui";
export default function Dashboard({
  tasks,
  companies,
  profiles,
  admin,
  preview,
  onOpen,
  onWork,
}: {
  tasks: Task[];
  companies: Company[];
  profiles: Profile[];
  admin: boolean;
  preview: boolean;
  onOpen: (t: Task) => void;
  onWork: (status?: string) => void;
}) {
  const s = stats(tasks);
  const upcoming = tasks
    .filter((t) => t.due_date && t.status !== "Completed")
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!))
    .slice(0, 5);
  const completed = tasks
    .filter((t) => t.status === "Completed")
    .sort((a, b) =>
      (b.completion_date || "").localeCompare(a.completion_date || ""),
    )
    .slice(0, 4);
  const people = profiles.filter((p) => p.role === "updater");
  return (
    <>
      <div className="kpi-grid">
        {[
          ["Total work", s.total, ClipboardList, ""],
          ["Completed", s.completed, CircleCheck, "Completed"],
          ["In progress", s.progress, Clock3, "In Progress"],
          ["Pending", s.pending, CircleDashed, "Pending"],
          ["Overdue", s.overdue, TriangleAlert, "Overdue"],
        ].map(([label, v, Icon, filter], i) => {
          const I = Icon as typeof ClipboardList;
          return (
            <button
              className={"kpi kpi-" + i}
              key={String(label)}
              onClick={() => onWork(String(filter))}
            >
              <div className="kpi-label">
                {String(label)}
                <I size={19} />
              </div>
              <strong>{String(v)}</strong>
            </button>
          );
        })}
      </div>
      <div className="overview-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>{admin ? "Progress by person" : "Your priorities"}</h2>
            <span className="muted">
              {admin ? `${people.length} people` : todayISO()}
            </span>
          </div>
          {admin ? (
            people.map((p, i) => {
              const st = stats(tasks.filter((t) => t.assigned_to === p.id));
              return (
                <div className="person-row" key={p.id}>
                  <span className={"avatar tone-" + (i % 3)}>
                    {p.full_name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="person-progress">
                    <div>
                      <strong>{p.full_name}</strong>
                      <span>
                        {st.completed} / {st.total} complete
                      </span>
                    </div>
                    <div className="progress-track">
                      <div style={{ width: st.percent + "%" }} />
                    </div>
                  </div>
                  <strong>{st.percent}%</strong>
                </div>
              );
            })
          ) : (
            <div className="priority-list">
              {["Overdue", "In Progress", "Pending", "On Hold"].map(
                (status) => (
                  <button key={status} onClick={() => onWork(status)}>
                    <Badge status={status} />
                    <strong>
                      {tasks.filter((t) => displayStatus(t) === status).length}
                    </strong>
                    <ChevronRight size={17} />
                  </button>
                ),
              )}
            </div>
          )}
        </section>
        <section className="panel completion-panel">
          <h2>Overall completion</h2>
          <div
            className="completion-ring"
            style={{
              background: `conic-gradient(var(--brand) ${s.percent}%,#edf2f0 0)`,
              border: 0,
              padding: 12,
            }}
          >
            <div className="ring-inner">
              <strong>{s.percent}%</strong>
              <span>completed</span>
            </div>
          </div>
          <p className="muted">
            {s.completed} of {s.total} responsibilities complete
            {s.hold > 0 ? ` · ${s.hold} on hold` : ""}
          </p>
        </section>
      </div>
      {admin && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Companies</h2>
            </div>
          </div>
          <div className="company-grid">
            {companies.map((c) => {
              const st = stats(tasks.filter((t) => t.company_id === c.id));
              return (
                <article className="company-card" key={c.id}>
                  <div className="company-card-title">
                    <span className="company-icon">
                      <Building2 size={23} />
                    </span>
                    <div>
                      <h3>{c.name}</h3>
                      <p className="muted">
                        {st.total} responsibilities ·{" "}
                        {
                          new Set(
                            tasks
                              .filter((t) => t.company_id === c.id)
                              .map((t) => t.assigned_to),
                          ).size
                        }{" "}
                        people
                      </p>
                    </div>
                  </div>
                  <div className="company-card-footer">
                    <span>
                      {st.pending} pending · {st.overdue} overdue
                    </span>
                    <strong>{st.percent}% complete</strong>
                  </div>
                  <div className="progress-track">
                    <div style={{ width: st.percent + "%" }} />
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
      <div className="overview-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>Upcoming & overdue</h2>
            <button className="text-button" onClick={() => onWork()}>
              View all
            </button>
          </div>
          {upcoming.length ? (
            upcoming.map((t) => (
              <button
                className="compact-task"
                key={t.id}
                onClick={() => onOpen(t)}
              >
                <div>
                  <strong>{t.particular}</strong>
                  <small>
                    {companies.find((c) => c.id === t.company_id)?.name} ·{" "}
                    {dateLabel(t.due_date)}
                  </small>
                </div>
                <Badge status={displayStatus(t)} />
              </button>
            ))
          ) : (
            <Empty
              title="No deadlines"
              body="Add a due date."
            />
          )}
        </section>
        <section className="panel">
          <h2>{admin ? "Work by frequency" : "Recently completed"}</h2>
          {admin ? (
            <div className="frequency-chart">
              {Array.from(new Set(tasks.map((t) => t.frequency))).map((f) => {
                const n = tasks.filter((t) => t.frequency === f).length;
                return (
                  <div className="bar-row" key={f}>
                    <span>{f}</span>
                    <div className="progress-track">
                      <div
                        style={{
                          width: (n / Math.max(tasks.length, 1)) * 100 + "%",
                        }}
                      />
                    </div>
                    <strong>{n}</strong>
                  </div>
                );
              })}
            </div>
          ) : completed.length ? (
            completed.map((t) => (
              <button
                className="compact-task"
                key={t.id}
                onClick={() => onOpen(t)}
              >
                <div>
                  <strong>{t.particular}</strong>
                  <small>{dateLabel(t.completion_date)}</small>
                </div>
                <CircleCheck size={18} />
              </button>
            ))
          ) : (
            <Empty
              title="No completed work"
              body=""
            />
          )}
        </section>
      </div>
    </>
  );
}
