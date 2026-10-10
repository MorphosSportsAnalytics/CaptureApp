import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { profileDisplayName } from "./profileDisplayName.js"

describe("profileDisplayName", () => {
  it("joins first and last name from snake_case fields", () => {
    assert.equal(profileDisplayName({ first_name: "Alex", last_name: "Smith" }), "Alex Smith")
  })

  it("supports camelCase profile rows", () => {
    assert.equal(profileDisplayName({ firstName: "Jamie", lastName: "Lee" }), "Jamie Lee")
  })

  it("returns empty for missing row or names", () => {
    assert.equal(profileDisplayName(null), "")
    assert.equal(profileDisplayName({}), "")
  })
})
