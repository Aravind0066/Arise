const test = require("node:test");
const assert = require("node:assert/strict");
const { getQuestStatus } = require("../utils/questStatus");

test("marks a future quest active", () => {
  assert.equal(getQuestStatus({ _id: "quest-1", deadline: new Date(Date.now() + 60_000) }), "active");
});

test("marks a past quest expired", () => {
  assert.equal(getQuestStatus({ _id: "quest-1", deadline: new Date(Date.now() - 60_000) }), "expired");
});

test("completed status takes precedence over deadline", () => {
  assert.equal(
    getQuestStatus({ _id: "quest-1", deadline: new Date(Date.now() - 60_000) }, new Set(["quest-1"])),
    "completed"
  );
});
