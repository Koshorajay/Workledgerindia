import { test } from "node:test";
import assert from "node:assert/strict";
import { loginAddress } from "../lib/username";
test("username sign-in normalizes case and whitespace and rejects email or malformed identifiers", () => {
  assert.equal(loginAddress(" ADMIN "), "admin@workledger.invalid");
  assert.equal(loginAddress("CS"), "cs@workledger.invalid");
  for (const bad of [
    "",
    "a",
    "first.last",
    "someone@example.com",
    "two names",
    "1user",
    "a".repeat(33),
  ])
    assert.throws(() => loginAddress(bad));
});
