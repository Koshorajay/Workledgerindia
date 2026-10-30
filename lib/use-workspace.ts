"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, configured } from "./supabase";
import {
  previewTasks,
  previewCompanies,
  previewProfiles,
  type Task,
  type Company,
  type Profile,
} from "./model";
import {
  previewTemplates,
  type ChecklistItem,
  type CompanyProfile,
  type ComplianceTemplate,
} from "./compliance";
type State = {
  tasks: Task[];
  companies: Company[];
  profiles: Profile[];
  templates: ComplianceTemplate[];
  companyProfiles: CompanyProfile[];
  checklist: ChecklistItem[];
  profile: Profile | null;
  loading: boolean;
  error: string;
  authenticated: boolean;
};
const empty: State = {
  tasks: [],
  companies: [],
  profiles: [],
  templates: [],
  companyProfiles: [],
  checklist: [],
  profile: null,
  loading: false,
  error: "",
  authenticated: false,
};
export function useWorkspace() {
  const [state, setState] = useState<State>(
    configured
      ? { ...empty, loading: true }
      : {
          ...empty,
          tasks: previewTasks,
          companies: previewCompanies,
          profiles: previewProfiles,
          templates: previewTemplates,
          profile: previewProfiles[0],
        },
  );
  const generation = useRef(0);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  const reload = useCallback(async () => {
    if (!supabase) return;
    const run = ++generation.current;
    setState((s) => ({ ...s, loading: true, error: "" }));
    const current = () => generation.current === run;
    try {
      const {
        data: { session },
        error: se,
      } = await supabase.auth.getSession();
      if (se) throw se;
      if (!session) {
        if (current()) setState(empty);
        return;
      }
      const { data: p, error: pe } = await supabase
        .from("profiles")
        .select("*")
        .eq("auth_user_id", session.user.id)
        .single();
      if (pe || !p?.active)
        throw new Error(
          "Your account is not active. Ask your administrator to link and activate your profile.",
        );
      const readAll = async (table: string) => {
        let result: Record<string, unknown>[] = [];
        for (let start = 0; ; start += 1000) {
          if (!current()) throw new Error("Session changed");
          const { data, error } = await supabase!
            .from(table)
            .select("*")
            .order("id")
            .range(start, start + 999);
          if (error) throw error;
          result = result.concat(data);
          if (data.length < 1000) break;
        }
        return result;
      };
      // Questionnaires and checklists are administrator-only; RLS would return no rows to updaters.
      const adminOnly = (table: string) =>
        p.role === "admin" ? readAll(table) : Promise.resolve([]);
      const [t, c, ps, tp, cp, ci] = await Promise.all([
        readAll("tasks"),
        readAll("companies"),
        readAll("profiles"),
        readAll("compliance_templates"),
        adminOnly("company_profiles"),
        adminOnly("company_checklist_items"),
      ]);
      if (current())
        setState({
          tasks: t as Task[],
          companies: c as Company[],
          profiles: ps as Profile[],
          templates: tp as ComplianceTemplate[],
          companyProfiles: cp as CompanyProfile[],
          checklist: ci as ChecklistItem[],
          profile: p,
          loading: false,
          error: "",
          authenticated: true,
        });
    } catch (e) {
      if (current())
        setState({
          ...empty,
          error:
            e instanceof Error ? e.message : "Unable to load the workspace",
        });
    }
  }, []);
  useEffect(() => {
    void reload();
    if (!supabase) return;
    let alive = true;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION") return;
      invalidate();
      setState({ ...empty, loading: true });
      setTimeout(() => {
        if (alive) void reload();
      }, 0);
    });
    return () => {
      alive = false;
      invalidate();
      data.subscription.unsubscribe();
    };
  }, [reload, invalidate]);
  return { ...state, preview: !configured, reload };
}
