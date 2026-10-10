import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { defaultExpandedCardId, initialExpandedCardIds } from "./cardCollapse.js"
import type { HomeCardViewModel } from "./buildHomeCards.js"

function card(id: string, hasHappeningNow = false): HomeCardViewModel {
  return {
    id,
    kind: "ward",
    title: id,
    isSelf: false,
    hasHappeningNow,
    uploadActions: [],
    initials: "X",
    upcomingEvents: [],
  }
}

describe("defaultExpandedCardId", () => {
  it("prefers the happening-now card", () => {
    const cards = [card("a"), card("live", true), card("c")]
    assert.equal(defaultExpandedCardId(cards), "live")
  })

  it("falls back to the first card when none are live", () => {
    const cards = [card("first"), card("second")]
    assert.equal(defaultExpandedCardId(cards), "first")
  })

  it("returns null for an empty list", () => {
    assert.equal(defaultExpandedCardId([]), null)
  })
})

describe("initialExpandedCardIds", () => {
  it("starts with a single expanded id", () => {
    const set = initialExpandedCardIds([card("a"), card("b", true)])
    assert.deepEqual([...set], ["b"])
  })
})
