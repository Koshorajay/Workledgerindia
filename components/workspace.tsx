"use client";
import { useEffect, useState, useMemo } from "react";
import {
  LayoutDashboard,
  ListTodo,
  Building2,
  Users,
  CalendarDays,
  ChevronRight,
  Plus,
  Menu,
  LogOut,
  CircleCheck,
  UserRound,
  RefreshCw,
  ClipboardList,
  ChartNoAxesCombined,
  ListChecks,
  BookOpenCheck,
  X,
} from "lucide-react";
import { useWorkspace } from "@/lib/use-workspace";
import { supabase } from "@/lib/supabase";
import { stats, previewProfiles, todayISO, type Task } from "@/lib/model";
import Dashboard from "./dashboard";
import Reports from "./reports";
import WorkList, { emptyFilters } from "./work-list";
import { TaskDetail } from "./task-detail";
import { Companies, People } from "./management";
import Library from "./library";
import Checklists from "./checklists";
import Auth from "./auth";
import { Modal } from "./ui";
const adminNav = [
  ["Overview", LayoutDashboard],
  ["All work", ListTodo],
  ["Companies", Building2],
  ["Checklists", ListChecks],
  ["Library", BookOpenCheck],
  ["People", Users],
  ["Deadlines", CalendarDays],
  ["Reports", ChartNoAxesCombined],
] as const;
const updaterNav = [
  ["Overview", LayoutDashboard],
  ["My work", ListTodo],
  ["Upcoming", CalendarDays],
  ["Completed", CircleCheck],
  ["Profile", UserRound],
] as const;
export default function Workspace({
  requiredRole,
}: {
  requiredRole?: "admin" | "updater";
}) {
  const db = useWorkspace();
  const [view, setView] = useState("Overview"),
    [company, setCompany] = useState("all"),
    [filters, setFilters] = useState(emptyFilters),
    [selected, setSelected] = useState<Task | null>(null),
    [toast, setToast] = useState(""),
    [more, setMore] = useState(false),
    [previewAs, setPreviewAs] = useState("admin");
  const profile = db.preview
    ? previewProfiles.find((p) => p.id === previewAs) || previewProfiles[0]
    : db.profile;
  const admin = profile?.role === "admin";
  const nav = admin ? adminNav : updaterNav;
  const allTasks = useMemo(
    () => db.tasks.filter((t) => admin || t.assigned_to === profile?.id),
    [db.tasks, admin, profile?.id],
  );
  const tasks = useMemo(
    () => allTasks.filter((t) => company === "all" || t.company_id === company),
    [allTasks, company],
  );
  const companies = db.companies.filter(
    (c) => admin || allTasks.some((t) => t.company_id === c.id),
  );
  useEffect(() => {
    setSelected(null);
    setCompany("all");
    setView("Overview");
    setFilters(emptyFilters);
  }, [profile?.id]);
  useEffect(() => {
    if (!db.preview && profile && requiredRole && profile.role !== requiredRole)
      location.replace(profile.role === "admin" ? "/admin/" : "/updater/");
  }, [db.preview, profile, requiredRole]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 6500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const ctx = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: Record<string, unknown>,
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!ctx || !profile) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        ctx.registerTool(
          {
            name: "get_work_summary",
            title: "Get current work summary",
            description:
              "Read counts and responsibilities visible to the signed-in user under the current company filter. Does not change tasks.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute: (input: unknown) => {
              if (
                !input ||
                typeof input !== "object" ||
                Array.isArray(input) ||
                Object.keys(input).length
              )
                throw new Error("Expected an empty object");
              return {
                preview: db.preview,
                company:
                  company === "all"
                    ? "All companies"
                    : db.companies.find((c) => c.id === company)?.name,
                summary: stats(tasks),
                tasks: tasks.map((t) => ({
                  id: t.id,
                  particular: t.particular,
                  status: t.status,
                  due_date: t.due_date,
                  review_required: t.review_required,
                })),
              };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, [tasks, profile, company, db.preview, db.companies]);
  function go(v: string) {
    setView(v);
    setFilters(emptyFilters);
    setMore(false);
    setSelected(null);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function openWork(status?: string) {
    setView(admin ? "All work" : "My work");
    setFilters({ ...emptyFilters, status: status || "all" });
  }
  function saved(s: string) {
    setToast(s);
    void db.reload();
  }
  function newTask(base?: Task) {
    const c =
      company === "all"
        ? companies.find((c) => c.active)
        : companies.find((c) => c.id === company);
    const p = db.profiles.find((p) => p.role === "updater" && p.active);
    if (!c || !p) {
      setToast("Add an active company and updater first.");
      return;
    }
    setSelected(
      base
        ? {
            ...base,
            id: "new",
            status: "Pending",
            completion_date: null,
            due_date: null,
            remarks: "",
            period_label: "",
            created_at: "",
            updated_at: "",
          }
        : {
            id: "new",
            company_id: c.id,
            assigned_to: p.id,
            particular: "",
            objective: "",
            activity: "",
            category: "",
            frequency: "",
            documents_required: "",
            timeline_text: "",
            reporting_person: "",
            source_pdf_name: null,
            source_reference: null,
            source_company: null,
            status: "Pending",
            due_date: null,
            completion_date: null,
            remarks: "",
            review_required: false,
            review_flags: [],
            period_label: "Initial responsibility",
            template_key: crypto.randomUUID(),
            compliance_template_id: null,
            created_at: "",
            updated_at: "",
          },
    );
  }
  if (db.loading && !profile)
    return (
      <div className="loading-state">
        <h2>Loading your workspace…</h2>
      </div>
    );
  if (db.error)
    return (
      <div className="loading-state">
        <h2>Workspace unavailable</h2>
        <p className="error">{db.error}</p>
        <button className="button" onClick={() => void db.reload()}>
          Try again
        </button>
        <button
          className="button secondary"
          onClick={() => void supabase?.auth.signOut()}
        >
          Sign out
        </button>
      </div>
    );
  if (!db.preview && !db.authenticated) return <Auth />;
  if (
    !profile ||
    (!db.preview && requiredRole && requiredRole !== profile.role)
  )
    return <div className="loading-state">Opening your workspace…</div>;
  const listTasks =
    view === "Completed"
      ? tasks.filter((t) => t.status === "Completed")
      : view === "Upcoming"
        ? tasks.filter(
            (t) =>
              t.status !== "Completed" &&
              t.due_date &&
              t.due_date >= todayISO(),
          )
        : tasks;
  const headings: Record<string, string> = {
    Overview: "Overview",
    "All work": "All work",
    "My work": "My work",
    Companies: "Companies",
    Checklists: "Compliance checklists",
    Library: "Compliance library",
    People: "People",
    Deadlines: "Deadlines",
    Reports: "Reports",
    Upcoming: "Upcoming work",
    Completed: "Completed work",
    Profile: "Profile",
  };
  return (
    <div className="app">
      <aside className="sidebar">
        <a className="brand" href="/">
          WorkLedger
        </a>
        <p className="eyebrow sidebar-label">
          {admin ? "ADMIN WORKSPACE" : "YOUR WORKSPACE"}
        </p>
        <nav>
          {nav.map(([n, I]) => (
            <button
              className={n === view ? "nav-item active" : "nav-item"}
              key={n}
              onClick={() => go(n)}
            >
              <I size={19} />
              {n}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="avatar">
            {profile.full_name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <strong>{profile.full_name}</strong>
            <small>{admin ? "Administrator" : "Updater"}</small>
          </div>
        </div>
        {!db.preview && (
          <button
            className="nav-item"
            onClick={() => void supabase?.auth.signOut()}
          >
            <LogOut size={17} />
            Sign out
          </button>
        )}
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <span className="desktop-only">Workspace</span>
            <span className="mobile-brand">WorkLedger</span>
            <ChevronRight size={14} />
            <strong>{view}</strong>
          </div>
          <div className="top-actions">
            {db.preview ? (
              <>
                <span className="preview-pill">Read-only preview</span>
                <a className="text-button desktop-only" href="/login/">
                  Sign in
                </a>
              </>
            ) : (
              <button
                className="icon-button"
                disabled={db.loading}
                aria-label="Refresh workspace"
                onClick={() => void db.reload()}
              >
                <RefreshCw size={17} />
              </button>
            )}
            <span className="avatar small">
              {profile.full_name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <h1>{headings[view] || view}</h1>
            </div>
            {["All work", "My work"].includes(view) && admin ? (
              <button
                className="button"
                disabled={db.preview}
                onClick={() => newTask()}
              >
                <Plus size={17} />
                Add work
              </button>
            ) : null}
          </div>
          {db.preview && (
            <div className="preview-banner">
              <ClipboardList size={20} />
              <div>
                <strong>Preview</strong>
                <p>
                  Sign in to update details.
                </p>
              </div>
              <label className="preview-role">
                <span>Preview as</span>
                <select
                  aria-label="Preview role"
                  value={previewAs}
                  onChange={(e) => {
                    setPreviewAs(e.target.value);
                    setView("Overview");
                    setFilters(emptyFilters);
                    setCompany("all");
                    setSelected(null);
                  }}
                >
                  {previewProfiles.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {!["Profile", "Companies", "People", "Library"].includes(view) && (
            <div className="section-toolbar">
              <div>
                <h2>
                  {view === "Overview"
                    ? "Workspace overview"
                    : view === "Deadlines"
                      ? "Due dates & timelines"
                      : view === "Checklists"
                        ? "Company setup"
                        : "Selected work"}
                </h2>
                <p className="muted">
                  {company === "all"
                    ? "All companies"
                    : companies.find((c) => c.id === company)?.name}
                </p>
              </div>
              <select
                aria-label="Company"
                value={company}
                onChange={(e) => {
                  setCompany(e.target.value);
                  setFilters(emptyFilters);
                }}
              >
                <option value="all">All companies</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {view === "Overview" && (
            <Dashboard
              tasks={tasks}
              companies={
                company === "all"
                  ? companies
                  : companies.filter((c) => c.id === company)
              }
              profiles={db.profiles}
              admin={!!admin}
              preview={db.preview}
              onOpen={setSelected}
              onWork={openWork}
            />
          )}
          {[
            "All work",
            "My work",
            "Upcoming",
            "Completed",
            "Deadlines",
          ].includes(view) && (
            <>
              {view === "Deadlines" && (
                <div className="notice">
                  {
                    tasks.filter((t) => !t.due_date && t.status !== "Completed")
                      .length
                  }{" "}
                  tasks need a due date.
                </div>
              )}
              <WorkList
                tasks={listTasks}
                companies={companies}
                profiles={db.profiles}
                admin={!!admin}
                filters={filters}
                setFilters={setFilters}
                onOpen={setSelected}
              />
            </>
          )}
          {view === "Reports" && admin && (
            <Reports
              tasks={tasks}
              companies={companies}
              profiles={db.profiles}
              onOpen={setSelected}
            />
          )}
          {view === "Companies" && admin && (
            <Companies
              companies={db.companies}
              tasks={allTasks}
              preview={db.preview}
              onSaved={saved}
              onSetup={(id) => {
                go("Checklists");
                setCompany(id);
              }}
            />
          )}
          {view === "Checklists" && admin && (
            <Checklists
              company={company}
              setCompany={setCompany}
              companies={companies}
              templates={db.templates}
              companyProfiles={db.companyProfiles}
              checklist={db.checklist}
              tasks={allTasks}
              profiles={db.profiles}
              preview={db.preview}
              onSaved={saved}
            />
          )}
          {view === "Library" && admin && (
            <Library
              templates={db.templates}
              profiles={db.profiles}
              preview={db.preview}
              onSaved={saved}
            />
          )}
          {view === "People" && admin && (
            <People
              profiles={db.profiles}
              tasks={allTasks}
              profile={profile}
              preview={db.preview}
              onSaved={saved}
            />
          )}
          {view === "Profile" && (
            <section className="panel profile-panel">
              <span className="avatar">
                {profile.full_name.slice(0, 2).toUpperCase()}
              </span>
              <h2>{profile.full_name}</h2>
              <p className="muted">
                Updater ·{" "}
                {profile.active ? "Active account" : "Inactive account"}
              </p>
              <a className="button secondary" href="/login/?change=1">
                Change password
              </a>
              {!db.preview && (
                <button
                  className="button"
                  onClick={() => void supabase?.auth.signOut()}
                >
                  Sign out
                </button>
              )}
            </section>
          )}
        </main>
        <nav className={"mobile-nav" + (admin ? " admin-nav" : "")}>
          {(admin
            ? adminNav.filter(([name]) =>
                ["Overview", "All work", "Companies", "Reports"].includes(name),
              )
            : updaterNav.slice(0, 4)
          ).map(
            ([n, I]) => (
              <button
                key={n}
                className={n === view ? "active" : ""}
                onClick={() => go(n)}
              >
                <I size={20} />
                <span>
                  {n === "All work"
                    ? "Work"
                    : n === "Companies"
                      ? "Companies"
                      : n}
                </span>
              </button>
            ),
          )}
          <button onClick={() => setMore(true)} aria-label="More navigation">
            <Menu size={20} />
            <span>More</span>
          </button>
        </nav>
      </div>
      {more && (
        <Modal title="Workspace menu" onClose={() => setMore(false)}>
          <nav className="more-menu">
            {nav.map(([n, I]) => (
              <button key={n} className="nav-item" onClick={() => go(n)}>
                <I size={20} />
                {n}
              </button>
            ))}
            {db.preview ? (
              <a className="nav-item" href="/login/">
                <LogOut size={20} />
                Sign in
              </a>
            ) : (
              <button
                className="nav-item"
                onClick={() => void supabase?.auth.signOut()}
              >
                <LogOut size={20} />
                Sign out
              </button>
            )}
          </nav>
        </Modal>
      )}
      {selected && (admin || selected.assigned_to === profile.id) && (
        <TaskDetail
          key={selected.id + selected.updated_at}
          task={selected}
          companies={companies}
          profiles={db.profiles}
          templates={db.templates}
          profile={profile}
          preview={db.preview}
          onClose={() => setSelected(null)}
          onSaved={saved}
          onNewPeriod={newTask}
        />
      )}{" "}
      {toast && (
        <div className="toast" role="status">
          <CircleCheck size={20} />
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
