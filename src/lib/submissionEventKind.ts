/** Stored submission event kinds (PortalAPI SUBMISSION_EVENT_KINDS). Never show these raw in UI. */
export type SubmissionEventKind = "game" | "practice" | "skills_session"

export function toSubmissionEventKind(raw: string | null | undefined): SubmissionEventKind | "" {
  const k = String(raw ?? "").trim().toLowerCase()
  if (k === "game") return "game"
  if (k === "practice" || k === "group_large") return "practice"
  if (
    k === "skills_session" ||
    k === "skill_session" ||
    k === "skill_small" ||
    k === "treadmill"
  ) {
    return "skills_session"
  }
  return ""
}
