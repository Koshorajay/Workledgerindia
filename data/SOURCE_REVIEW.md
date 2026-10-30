# Responsibility PDF extraction QA

37 source responsibilities captured: Omprasanth 12, Sasidharan 11, CS 14. Every PDF has one landscape A4 page. Text was extracted with pdftotext -layout and the full page of each PDF was rendered with Poppler and visually inspected.

## Exact source preservation

- All three headings state `Incore SemiConductors Private Limited`. No source row identifies `Ter___lt Tech` or `Par__i`; no automatic company remapping or duplication was performed.
- Particular, objective, activity, frequency, and timeline text are transcribed verbatim with wrapped lines joined by spaces. Capitalization, abbreviations, punctuation, and apparent errors are preserved.
- No PDF contains a Category or Documents Required column. `category` and `documents_required` are null in all records rather than guessed.
- Reporting Person exists only in Om Prasanth's table and is `Madhusudan` on all 12 records. Sasidharan and CS reporting persons are null.
- Om Prasanth's heading uses `Om Prasanth`; its Coordination Person column uses `Omprasanth` for all 12 records. The requested normalized `assigned_person` uses `Omprasanth`. No duties were moved to Madhusudan.
- CS's four blank activities are literal em dashes in the source, preserved as `—`.
- `source_reference` gives source filename, page 1, and the one-based data-row number, excluding the table header. IDs are deterministic by source role and row order (`om-01`, `sasi-01`, `cs-01`, etc.).

## Ambiguities requiring review

- Omprasanth rows 1-5: `T+1/2 Days` is ambiguous, and T is undefined. Row 6 has `Daily / T+1` without an anchor.
- Omprasanth rows 7-11: Frequency is `Weekly` while every timeline says `7th of consecutive month`. Credit Card Upload additionally says entries are passed monthly. These conflicts are retained.
- Annual fixed dates (`By 30th June`, `20th August`) provide no period/year. Relative monthly and quarterly dates also require an assigned task period.
- Sasidharan's GST computation/payments combines `7th and 17th of consecutive month` in one source responsibility. The source does not say how to split it into milestones.
- Sasidharan's GST Returns says only `Quarterly`; Advance Tax, GST Annual Returns, Tax Audit, and Income Tax Return have nonspecific due-date wording. The source's statutory dates have not been validated against current law.
- Every CS Timeline cell contains a deliverable or label rather than a calendar deadline, including `CS` for the final two rows. Those cells remain in `timeline_text`; they were not silently reclassified as required evidence.
- CS MSME, AOC-4, MGT-14, and MGT-7 give only `CS` as their objective and `—` as their activity. Specific obligations are not inferred.
- CS AGM Resolutions says `Follow up with CS for AGM Resolution drafter`. This apparent wording issue is preserved.
- XBRL and GSTR 9C are explicitly conditional; applicability has not been assumed.

## Files

- `responsibilities.json`: normalized, complete 37-row array.
- Three `.txt` files: layout-preserving raw extraction.
- `rendered/*.png`: source-page renderings used for visual verification.

All records have the 14 requested fields and unique IDs. No due dates, task statuses, completion percentages, required documents, categories, or company assignments have been invented.

## Confirmed application mapping

After extraction, the user explicitly instructed applying all source responsibilities to both `Ter___lt Tech` and `Par__i`. The application therefore prepares 74 initial responsibilities. This is a user-authorized mapping; original source-company text remains unchanged. All initial due dates are unset and all source records require review.
