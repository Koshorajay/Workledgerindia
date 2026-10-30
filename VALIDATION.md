# Validation — 8 October 2026

## Passed

- TypeScript check and ESLint (zero errors or warnings).
- Production static export for preview and connected configurations.
- Connected-build privacy scan: extracted source duties and PDF filenames absent from public assets.
- Five automated tests: complete source mapping (37 x 2), derived overdue dates, combined filters, CSV escaping/formula neutralization, and PostgreSQL authorization integration.
- PostgreSQL integration covers all three updater identities, other-person SELECT/UPDATE isolation, protected task columns, task creation denial, role escalation denial, audit/history insert/delete denial, automatic task history, evidence isolation, audited removal before deleting evidence bytes, future completion-date rejection and disabled accounts.
- Browser checks at 320, 390 and 1440 CSS pixels: no horizontal page overflow. Phone task cards, company/search filtering, full-screen task form and bottom navigation verified.
- Preview-role counts: Omprasanth 24, CS 28; administrator 74. Other-person writes are tested at the database layer, not inferred from preview UI.
- Import review stages 74 records for both companies, preserving the source references. Preview cannot save/import.
- Browser summary tool: valid request returned the selected company's 37 rows; extra input was rejected without changing state.
- Production dependency audit: zero known vulnerabilities at build time.

## Earlier build verification limits

Real email/password sign-in and recovery delivery, live hosted evidence uploads/downloads, deployment of the account-management Edge Function, real multi-user update/reassignment flows and final production-domain Auth redirects. A live Supabase project and username accounts were configured subsequently; see the update below. See SUPABASE_SETUP.txt for provisioning and live acceptance checks.

The SQL integration test uses embedded PostgreSQL with minimal Auth and Storage schema fixtures. It verifies SQL enforcement, not the external Supabase services themselves.

The full development dependency audit reported a braces/micromatch/fast-glob advisory chain in ESLint tooling. The production-only audit is clean. The recommended automated fix would downgrade the Next.js ESLint configuration across major versions; it was not applied. Avoid passing untrusted patterns into development tooling and review a compatible upstream patch when available.

## Supabase preparation — 9 October 2026

- Privileged lookup helpers and audit/guard triggers moved into the unexposed private schema. Anonymous schema access and direct authenticated audit-function execution are revoked; RLS helpers retain only the required execution grants.
- PostgreSQL integration tests pass with privilege assertions and all existing role/evidence checks.
- Supabase browser SDK pinned to the existing lockfile version, 2.117.3.
- The connected organization was verified as Free. Project creation remains pending because the connector advertises a legacy cost-confirmation field while the server exposes the newer creation flow. Dashboard sign-in is the fallback; no existing project was changed.

## Connected setup — 10 October 2026

- WorkLedger project ACTIVE_HEALTHY in Mumbai on Kishorajay's Org Free plan.
- All six tables have RLS; evidence bucket is private with a 10 MB limit. Privileged internal functions are unexposed; automatic-RLS helper API execution was revoked. Missing actor foreign-key indexes were added.
- Usernames admin, omprasanth, sasidharan, cs configured using internal reserved-domain Auth aliases. Admin Auth UUID and password preserved. No staff email or invitation was used.
- 74 responsibilities imported once: 24 Omprasanth, 22 Sasidharan, 28 CS. All Pending, no invented deadlines; source review flags retained.
- Local TypeScript and PostgreSQL/username tests pass.
- Live authorization checks: all three staff logins see only their own records; other-person SELECT/UPDATE and deadline edits are blocked; staff cannot invoke administrator password resets. Anonymous table access is denied.
- Live password changes reject the wrong current password; the old password fails after a change. Administrator resets succeed and create credential-free audit records. The staff starter password was restored after testing.
- manage-users deployed with JWT verification and active-admin checking. The exact frontend APP_ORIGIN is configured; production Auth URLs are set and public signup is disabled.
- Starter passwords are in a separate local mode-600 file and excluded from the Site/source ZIP. Temporary server credentials are removed after setup verification.

Remaining: the user's administrator password sign-in and acceptance on their physical phone. The owner authorized public access to the sign-in page; task data remains authenticated and restricted. The Free-plan leaked-password-protection advisory is a paid-feature limitation; no upgrade was made. Unused-index notices are expected before normal workload accumulates.

- Live Storage check passed: an assigned staff member uploaded a small test PNG, linked its metadata, and downloaded the 60-second signed URL; another staff member could access neither metadata nor file. Admin removal followed the metadata-before-object policy, and no test attachments remain.
- Connected phone browser check at 390 CSS pixels: real username login reached the staff dashboard and its 28 tasks, task cards and full-screen status/remarks/evidence form rendered without horizontal overflow.
- Connected public assets scan contains no server key, starter passwords, personal administrator email or source PDF filenames.

## Interface cleanup — 10 October 2026

Brand badges and login decoration/marketing copy removed. The login is a compact username/password form. Reports, Import & review, Audit log and Settings views/navigation are removed, including the mobile Reports shortcut. Backend auditing and the 74 existing responsibilities are retained.

## Compliance copy — 24 October 2026

This is a separate copy of WorkLedger. The original folder and repository were not modified.

- TypeScript and ESLint pass (only the inherited `dashboard.tsx` unused-variable warning remains).
- 14 automated tests pass: the 6 inherited tests plus 8 new ones.
  - Library: 52 templates with unique codes, consistent frequency and rule, https links on gov.in domains, known questionnaire facts; the seed migration matches the data file; the template form round-trips every template.
  - Suggestions for private company, LLP (QRMP), OPC (composition, recently incorporated) and proprietorship profiles match expected sets, with reasons.
  - Due dates: GSTR-1/3B (including QRMP 22nd/24th by GSTIN state), PMT-06 months, TDS March override, Forms 140/131 quarters, advance tax, MSME-1, PAS-6, CBDT Circular 7/2026 extensions, AGM-based AOC-4/MGT-7, OPC dates, triennial DIR-3 KYC, five-year ADT-1, calendar-year Board meetings, incorporation cut-off, month-end clamping.
  - PostgreSQL (PGlite) with all five migrations: updaters can read templates but not change them or see questionnaires and checklists; review stamps cannot be spoofed; content edits clear the review; unreviewed templates cannot be activated or create work; activation is admin-only, needs a saved questionnaire and records the activator; duplicate periods are skipped; updaters cannot change a task's template link; audit rows are written.
- Production static build succeeds.
- Browser check of the read-only preview (desktop and 375 px phone, no horizontal overflow): Library list and detail, questionnaire, 23 suggestions with reasons, apply step generating 22 Oct–Dec 2026 responsibilities with extensions and flags, and bulk assignment.

Not yet verified: saving against a live Supabase project (questionnaire save, activation, task creation, template review through PostgREST). Those paths are covered by the SQL tests only. Next.js upgraded to 16.4.3 (production audit: 0 vulnerabilities).

## All-in-one setup SQL — 30 October 2026

- `SUPABASE_SETUP.sql` is generated from the five migrations (`npm run setup:sql`) and runs as one transaction: a pre-check, the migrations in order, then the first administrator. 15 automated tests pass; the new one applies the file on embedded PostgreSQL (PGlite).
  - It refuses to run when WorkLedger tables already exist or the `admin@workledger.invalid` Auth user is missing. A failure part-way (a clashing table before the compliance migration) undoes the earlier migrations too.
  - The schema it creates matches applying the files one at a time: columns, constraints, indexes, triggers, policies, functions, table grants, schema privileges and RLS flags are identical.
- A connected-mode production build with placeholder Supabase values passes and leaves the source responsibilities out of the public output. The three preview staff first names in `lib/model.ts` remain in the JavaScript.

Run in a live Supabase SQL editor on 30 October 2026 (reported by the project owner): it finished with "Success. No rows returned". Sign-in, Storage, the `manage-users` function and the compliance screens have not been checked against that project yet. The generated file was then removed from the project; `npm run setup:sql` recreates it.
