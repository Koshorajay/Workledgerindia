#**Try for free:**
ID= trywlin
pass= Try@workledger


# WorkLedger Compliance

A separate copy of WorkLedger (the two-company workspace for **Ter\_\_\_lt Tech** and **Par\_\_i**) that adds a statutory compliance layer for any number of companies:

1. **Compliance library** (admin › Library): 52 reviewed-before-use GST, income-tax and Company/ROC templates with descriptions, frequency, structured deadline rules, required documents and official references. See `data/COMPLIANCE_SOURCES.md`.
2. **Company setup questionnaire** (admin › Checklists): company type, registrations (PAN, TAN, GSTINs), financial year, GST scheme and turnover, TDS/TCS, tax audit, AGM and company-law facts. It suggests applicable templates and says why; an administrator reviews and activates the checklist.
3. **Apply checklist and assign work**: choose a due-date window, and the app generates one responsibility per period with the statutory due date (including notified extensions). Assign each row individually or in bulk, then create them. Duplicates for the same company, template and period are skipped.

**Use a new Supabase project for this copy.** Its migrations add tables and change task rules; never apply them to the original WorkLedger project. See `SUPABASE_SETUP.txt`.

The original two-company preview data and seed script are inherited unchanged and remain optional.

## Start here

```sh
npm ci
npm run dev
```

Open http://localhost:3000. With no environment values, this is an explicitly **read-only source preview**. It contains the 37 supplied responsibilities applied to both companies (74 records). No login credentials or completed work are invented.

This copy is not connected to any Supabase project yet. See **SUPABASE_SETUP.txt** to create its own project. Connected builds omit the source dataset from browser assets.

## Included

- Next.js App Router, React, TypeScript; custom responsive light-theme CSS.
- Username/password sign-in, current-password changes and administrator resets; `/admin/` and `/updater/` routing.
- Phone bottom navigation, task cards, touch controls and full-screen update dialogs. Desktop sidebar and task tables.
- Dynamic companies; admin account creation/edit/deactivation; assignment changes and task creation. Administrator navigation includes Overview, All work, Companies, People, Deadlines and Reports.
- Reports on desktop and mobile: reporting periods, work filters, CSV export, Print / PDF, status distribution and completion trend. Period filters use confirmed due dates.
- Status, completion date, remarks, evidence, optimistic concurrency check and automatic task history.
- Private evidence bucket, 10 MB file limit, PDF/Word/Excel/image support and 60-second signed download links.
- Search, company/person/frequency/status/review/date filters, sorting, pagination and completion indicators.
- The supplied PDFs were extracted and visually verified; their original wording and source references are in `data/responsibilities.json`. Source import is available through the administrative seed script.
- Database-enforced permissions, protected task columns, immutable audit/history and audited evidence removal.
- Optional read-only browser WebMCP summary tool, using the same authorized task data and company filter.

## Compliance rules

- Templates start **Needs review**. Saving one as Reviewed records the real reviewer, date and verification date in the database; edits to a reviewed template's content need a fresh review. Templates are retired, never deleted.
- Only reviewed templates can be activated in a checklist or create work. Both rules are enforced by database triggers as well as the interface.
- Questionnaires and checklists are administrator-only (RLS). Updaters can read templates so their tasks show official references.
- Checklist activation runs in one transaction (`activate_compliance_checklist`) and records who activated it.
- Generated responsibilities link to their template (`tasks.compliance_template_id`, `template_key = tpl:<code>`). Dates that depend on events (planned AGM, triennial DIR-3 KYC, five-year auditor appointment) or have no fixed date are flagged for review.
- Due dates are statutory defaults. Check current CBIC, CBDT and MCA notifications before relying on them; record extensions on the template.

## Data decisions

The user confirmed the two company names exactly, including underscores, and instructed applying the supplied Incore responsibilities to both. The source company remains `Incore SemiConductors Private Limited` in each record. Om Prasanth / Om Prasad / Omprasanth is represented as one updater named `Omprasanth`.

There are 12 Omprasanth, 11 Sasidharan and 14 CS source responsibilities. Categories and required documents were not present in the PDFs and remain empty. Every initial task is pending, flagged for source review and has no due date. See `data/SOURCE_REVIEW.md` for ambiguities.

Recurring work uses explicit **period instances**. An admin opens a task and chooses **New period**, sets its period label and confirmed due date, then saves. This retains completed work and evidence. Automatic recurrence and legal-date inference are deliberately not enabled because the source timelines do not define unambiguous scheduling rules. Overdue is computed when a task is not completed and its confirmed due date is before today's date in Asia/Kolkata.

## Commands

- `npm run dev` — development server and source preview preparation.
- `npm run typecheck` — TypeScript.
- `npm run lint` — ESLint.
- `npm test` — source/filter/CSV tests and PostgreSQL RLS integration tests using PGlite.
- `npm run build` — production static export to `out/`.
- `npm run seed:templates` — regenerate the template seed migration from `data/compliance-templates.ts`.
- `npm run setup:sql` — write `SUPABASE_SETUP.sql` when needed (every migration plus the first administrator, as one transaction for the SQL editor). It is not kept in the repository.
- `npm start` — serve the built export locally (127.0.0.1:3000).
- `node scripts/import/seed.mjs` — dry-run source summary.
- `node --env-file=.env.local scripts/import/seed.mjs --apply` — administrative seed after setup.

Node.js 22 LTS or later is recommended. Keep package-lock.json. `.env.local`, node_modules, generated build output and runtime files are ignored.

## Architecture

```
app/                         root, login, admin and updater routes
components/                  dashboards, work, details, import, management, reports
lib/                         model, Supabase client and session-aware data loader
data/responsibilities.json   authoritative extracted source rows (not public assets)
data/preview.generated.json build-selected preview dataset; empty in connected builds
supabase/migrations/         tables, constraints, triggers, RLS and Storage policies
supabase/functions/          server-side admin account provisioning
scripts/import/             idempotent seed workflow
tests/                      data rules and PostgreSQL authorization tests
```

Task changes and audit/history inserts run in the same PostgreSQL transaction. Client code cannot insert or alter history. Updaters cannot change task identity, company, person, deadlines, source information or permissions. Disabled accounts lose database access even if their Auth session has not expired. Session changes invalidate in-flight requests so previous-user data cannot appear in the next session.

Attachments use `evidence/<company_id>/<task_id>/<random>-<filename>`, where `evidence` is the private bucket. Existing objects cannot be overwritten. Administrators first remove the attachment metadata (audited), then its unreferenced object. Upload failures preserve task updates and report that evidence was not saved.

## Deployment

`output: 'export'` produces static frontend files. Supabase provides the production backend. Vercel can deploy this Next.js project, or any static host can serve `out/`. Hosting audience settings control who can reach the sign-in page; WorkLedger authentication and RLS protect the data.

The frontend uses only NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. SUPABASE_SERVICE_ROLE_KEY is optional for the local seed script; the account-management Edge Function uses it only in Supabase's server environment. It must never be set as a NEXT_PUBLIC variable or committed.

## Validation limits

The SQL policies are integration-tested against embedded PostgreSQL with mocked Supabase Auth/Storage schemas. This verifies RLS and trigger behavior, but does not substitute for live Supabase Auth email delivery, hosted Storage uploads, Edge Function deployment and Vercel/Supabase end-to-end acceptance tests. So far only `SUPABASE_SETUP.sql` has been run on a live Supabase project (it succeeded); sign-in, Storage, the Edge Function and the compliance screens have not been checked against one yet.

## Primary documentation

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords)
- [Supabase Edge Function deployment](https://supabase.com/docs/guides/functions/deploy)
- [Next.js static exports](https://nextjs.org/docs/app/guides/static-exports)
