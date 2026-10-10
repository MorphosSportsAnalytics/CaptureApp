import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { PORTAL_UPLOAD_TICKET_HEADER, userFacingPortalError } from "./index.js"
import { runPresignedPortalVideoUpload } from "./upload.js"

describe("portal-api-client upload", () => {
  it("userFacingPortalError maps video_too_long", () => {
    const msg = userFacingPortalError(422, { code: "video_too_long", maxSeconds: 300 }, "fail")
    assert.match(msg, /300/)
  })

  it("runPresignedPortalVideoUpload orchestrates presign put complete submit with upload ticket", async () => {
    const calls: string[] = []
    let putUrl = ""
    let putTicketHeader = ""
    let completeBody: Record<string, unknown> = {}
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input)
      if (url.includes("/presign")) {
        calls.push("presign")
        return new Response(
          JSON.stringify({
            uploadId: "u1",
            uploadUrl: "",
            objectKey: "portal-uploads/pending/u1/clip.mp4",
            gsUri: "gs://bucket/portal-uploads/pending/u1/clip.mp4",
            uploadTicket: "ticket-abc",
          }),
          { status: 200 },
        )
      }
      if (url.includes("/object?")) {
        calls.push("put")
        putUrl = url
        putTicketHeader = new Headers(init?.headers).get(PORTAL_UPLOAD_TICKET_HEADER) ?? ""
        assert.equal(init?.method, "PUT")
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      if (url.includes("/complete")) {
        calls.push("complete")
        completeBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>
        return new Response(JSON.stringify({ id: "sub-1", status: "pending" }), { status: 201 })
      }
      if (url.includes("/submit-for-analysis")) {
        calls.push("submit")
        return new Response(JSON.stringify({ id: "sub-1", status: "processing" }), { status: 200 })
      }
      return new Response("not found", { status: 404 })
    }

    const row = await runPresignedPortalVideoUpload(
      { baseUrl: "http://localhost:3002", bearerToken: "token", fetchImpl },
      {
        athleteId: "ath-1",
        selectedFocusSchemas: ["hockey_athlete_top_speed_v1", "hockey_athlete_stick_handling_v1", "hockey_athlete_shot_accuracy_v1"],
        body: { kind: "bytes", bytes: new Uint8Array([1, 2, 3]), fileName: "clip.mp4", mimeType: "video/mp4" },
        durationSeconds: 60,
        recordedAtMs: 1_700_000_000_000,
      },
    )
    assert.equal(row.id, "sub-1")
    assert.deepEqual(calls, ["presign", "put", "complete", "submit"])
    assert.match(putUrl, /uploadTicket=ticket-abc/)
    assert.equal(putTicketHeader, "ticket-abc")
    assert.equal(completeBody.uploadTicket, "ticket-abc")
    assert.equal(completeBody.recordedAtMs, 1_700_000_000_000)
    assert.equal(completeBody.athleteId, "ath-1")
    assert.equal((completeBody.selectedFocusSchemas as string[]).length, 3)
  })

  it("skips auto-submit when teamEventId is set and forwards athleteEventId", async () => {
    const calls: string[] = []
    let completeBody: Record<string, unknown> = {}
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input)
      if (url.includes("/presign")) {
        calls.push("presign")
        return new Response(
          JSON.stringify({
            uploadId: "u1",
            uploadUrl: "",
            objectKey: "k",
            gsUri: "gs://b/k",
            uploadTicket: "t1",
          }),
          { status: 200 },
        )
      }
      if (url.includes("/object?")) {
        calls.push("put")
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      if (url.includes("/complete")) {
        calls.push("complete")
        completeBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>
        return new Response(JSON.stringify({ id: "sub-2" }), { status: 201 })
      }
      if (url.includes("/submit-for-analysis")) {
        calls.push("submit")
        return new Response(JSON.stringify({ id: "sub-2" }), { status: 200 })
      }
      return new Response("not found", { status: 404 })
    }

    await runPresignedPortalVideoUpload(
      { baseUrl: "http://localhost:3002", bearerToken: "token", fetchImpl },
      {
        athleteId: "ath-1",
        teamEventId: "evt-team",
        body: { kind: "bytes", bytes: new Uint8Array([1]), fileName: "g.mp4", mimeType: "video/mp4" },
      },
    )
    assert.deepEqual(calls, ["presign", "put", "complete"])
    assert.equal(completeBody.teamEventId, "evt-team")

    calls.length = 0
    await runPresignedPortalVideoUpload(
      { baseUrl: "http://localhost:3002", bearerToken: "token", fetchImpl },
      {
        athleteId: "ath-1",
        athleteEventId: "evt-ath",
        body: { kind: "bytes", bytes: new Uint8Array([1]), fileName: "g.mp4", mimeType: "video/mp4" },
      },
    )
    assert.ok(calls.includes("submit"))
    assert.equal(completeBody.athleteEventId, "evt-ath")
  })

  it("rejects presign without uploadTicket", async () => {
    const fetchImpl = async (): Promise<Response> =>
      new Response(
        JSON.stringify({
          uploadId: "u1",
          objectKey: "k",
          gsUri: "gs://b/k",
        }),
        { status: 200 },
      )
    await assert.rejects(
      () =>
        runPresignedPortalVideoUpload(
          { baseUrl: "http://localhost:3002", bearerToken: "token", fetchImpl },
          {
            body: { kind: "bytes", bytes: new Uint8Array([1]), fileName: "g.mp4", mimeType: "video/mp4" },
          },
        ),
      /Could not prepare upload/,
    )
  })
})
