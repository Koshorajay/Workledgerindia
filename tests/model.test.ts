import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createPreviewTasks,
  stats,
  displayStatus,
  csvCell,
} from "../lib/model";
import sourceRecords from "../data/responsibilities.json";
const previewTasks = createPreviewTasks(sourceRecords);
import { filterTasks, emptyFilters } from "../components/work-list";
test("source duties are duplicated exactly once per confirmed company without invented deadlines", () => {
  assert.equal(sourceRecords.length, 37);
  assert.equal(previewTasks.length, 74);
  assert.equal(new Set(previewTasks.map((t) => t.id)).size, 74);
  for (const t of previewTasks) {
    assert.equal(t.due_date, null);
    assert.equal(t.review_required, true);
    assert.equal(t.status, "Pending");
    assert.equal(
      t.particular,
      sourceRecords.find((r) => r.id === t.template_key)?.particular,
    );
  }
  assert.deepEqual(stats(previewTasks), {
    total: 74,
    completed: 0,
    progress: 0,
    pending: 74,
    overdue: 0,
    hold: 0,
    percent: 0,
  });
});
test("overdue is derived, excludes completed, and starts after due day", () => {
  assert.equal(
    displayStatus({ status: "Pending", due_date: "2026-10-07" }, "2026-10-08"),
    "Overdue",
  );
  assert.equal(
    displayStatus({ status: "Pending", due_date: "2026-10-08" }, "2026-10-08"),
    "Pending",
  );
  assert.equal(
    displayStatus({ status: "On Hold", due_date: "2026-10-07" }, "2026-10-08"),
    "Overdue",
  );
  assert.equal(
    displayStatus(
      { status: "Completed", due_date: "2026-10-07" },
      "2026-10-08",
    ),
    "Completed",
  );
});
test("combined search, person and date filters do not include unknown dates", () => {
  const f = filterTasks(previewTasks, {
    ...emptyFilters,
    person: "person-1",
    search: "Sales Register",
  });
  assert.equal(f.length, 2);
  assert.ok(f.every((t) => t.assigned_to === "person-1"));
  assert.equal(
    filterTasks(previewTasks, { ...emptyFilters, from: "2026-01-01" }).length,
    0,
  );
});
test("CSV escapes values and neutralizes spreadsheet formulas", () => {
  assert.equal(csvCell('He said "done"'), '"He said ""done"""');
  assert.equal(csvCell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"');
  assert.equal(csvCell(" +SUM(A1)"), '"\' +SUM(A1)"');
});
