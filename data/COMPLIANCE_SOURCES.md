# Compliance library sources and review notes

The starter library in `data/compliance-templates.ts` has 52 templates: 14 GST, 17 income-tax and 21 Company / ROC (including LLP). Each was checked on 24 October 2026 against the sources below. Every template is seeded as **Needs review**. An administrator must confirm it in the app before it can be activated for a company. That review stamps the reviewer and date in the database.

After editing the file, run `npm run seed:templates` to regenerate `supabase/migrations/20261024120100_seed_compliance_templates.sql`. A test fails if the two drift apart.

## Points that shaped the library

- **Income-tax Act, 2025 / Income-tax Rules, 2026 (from 1 April 2026).** Forms were renumbered: 24Q → 138, 26Q → 140, 27Q → 144, 27EQ → 143, 16 → 130, 16A → 131, 27D → 133, 3CA/3CB/3CD → 26, 3CEB → 48, 61A → 165. Form 143 (TCS) now follows the TDS dates (31 Jul, 31 Oct, 31 Jan, 31 May); Form 27EQ used the 15th. FY 2025-26 filings still use the 1961 Act forms.
- **CBDT Circular No. 7/2026 (28 Sep 2026).** For AY 2026-27, audited returns move from 31 Oct to 21 Nov 2026 and audit reports to 21 Oct 2026. These are stored as extensions on the two templates, not as changes to the rule.
- **Non-audit business returns.** The Income Tax Department reported 31 Aug 2026 after the Finance Act, 2026. Guides differ on firms filing ITR-5, so that template is flagged in its notes.
- **DIR-3 KYC.** G.S.R. 943(E) (31 Dec 2025, effective 31 Mar 2026) makes it once every three financial years, by 30 June. The questionnaire asks for the next KYC year. Without it, each year's row is flagged for confirmation.
- **Small company.** G.S.R. 880(E) (1 Dec 2025) raises the limits to ₹10 crore paid-up capital and ₹100 crore turnover.
- **GST.** GSTR-9 is optional up to ₹2 crore (Notification 15/2025-CT). GSTR-4 is due 30 June from FY 2024-25. QRMP GSTR-3B is due on the 22nd or 24th by state; the 24th is used only when every GSTIN entered is from a 24th-day state.
- **MCA.** AOC-4 is due 30 days and MGT-7/7A 60 days after the AGM (OPC: AOC-4 within 180 days of year end). No FY 2025-26 extension had been notified by mid-October 2026. Sources differ on CSR-2 timing; the default uses the AOC-4 date.
- **Practical schedules.** The quarterly Board meeting template plans one meeting each quarter to meet the 120-day rule. This is a scheduling choice, not a statutory date.

## Official sources

- CBDT FAQs on forms under the Income-tax Rules, 2026: https://www.incometaxindia.gov.in/faqs-and-guidance-notes-on-forms-as-per-income-tax-rules-2026
- Form FAQs (138, 140, 143, 144, 130, 131, 26): https://www.incometaxindia.gov.in/documents/d/guest/form-140-faqs (same pattern for each form)
- CBDT Circular No. 7/2026: https://www.incometax.gov.in/iec/foportal/sites/default/files/2026-09/Circular-7-2026.pdf
- CGST Act and Rules (CBIC tax information portal): https://taxinformation.cbic.gov.in/
- GST portal returns manual: https://tutorial.gst.gov.in/userguide/returns/index.htm
- MCA AOC-4: https://www.mca.gov.in/content/mca/global/en/mca/e-filing/annual-filings/form-aoc4.html
- MCA V3 form list (14 July 2025): https://www.mca.gov.in/content/dam/mca/pdf/List-of-38-forms.pdf
- MCA DIR-3 KYC advisory: https://www.mca.gov.in/bin/dms/getdocument?mds=5wBuXrnw5F5hFYBugmtq1Q%3D%3D&type=open

Several secondary guides were used only to cross-check dates; the template notes say where sources disagreed. Government extensions are frequent, so confirm each due date against current notifications before relying on it.
