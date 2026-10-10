/** Browser-safe MIME guess for video uploads (no Node/auth dependencies). */
export function guessVideoMime(fileName: string, contentType?: string): string {
  const ct = (contentType ?? "").trim().toLowerCase()
  if (ct.startsWith("video/")) return ct
  const ext = fileName.includes(".") ? fileName.split(".").pop()?.toLowerCase() : ""
  if (ext === "mov") return "video/quicktime"
  if (ext === "webm") return "video/webm"
  if (ext === "mkv") return "video/x-matroska"
  return "video/mp4"
}
