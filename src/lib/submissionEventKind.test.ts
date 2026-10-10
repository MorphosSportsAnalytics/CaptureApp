import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { toSubmissionEventKind } from "./submissionEventKind"

describe("toSubmissionEventKind", () => {
  it("maps skill_session to skills_session", () => {
    assert.equal(toSubmissionEventKind("skill_session"), "skills_session")
    assert.equal(toSubmissionEventKind("skills_session"), "skills_session")
  })

  it("maps game and practice", () => {
    assert.equal(toSubmissionEventKind("game"), "game")
    assert.equal(toSubmissionEventKind("practice"), "practice")
  })
})
