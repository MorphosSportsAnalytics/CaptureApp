import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildQrMatrix } from "./qrCodeMatrix.js"

describe("buildQrMatrix", () => {
  it("returns a square grid with quiet-zone margin", () => {
    const matrix = buildQrMatrix("https://portal.example/invite/INV123")
    assert.ok(matrix.size >= 21)
    assert.equal(matrix.cells.length, matrix.size * matrix.size)
    assert.equal(matrix.cells[0], false)
    assert.equal(matrix.cells[matrix.size + 1], false)
  })

  it("encodes different URLs differently", () => {
    const a = buildQrMatrix("https://portal.example/invite/AAA")
    const b = buildQrMatrix("https://portal.example/invite/BBB")
    assert.notDeepEqual(a.cells, b.cells)
  })
})
