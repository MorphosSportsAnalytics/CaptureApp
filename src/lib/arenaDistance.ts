import type { SportArenaOption } from "@morphos/portal-api-client"

export function arenaDistanceSq(
  arena: SportArenaOption,
  gps: { lat: number; lng: number },
): number | null {
  if (arena.latitude == null || arena.longitude == null) return null
  return (arena.latitude - gps.lat) ** 2 + (arena.longitude - gps.lng) ** 2
}

export function nearestArenaId(arenas: SportArenaOption[], gps: { lat: number; lng: number }): string {
  let best = ""
  let bestDist = Number.POSITIVE_INFINITY
  for (const arena of arenas) {
    const d = arenaDistanceSq(arena, gps)
    if (d == null || d >= bestDist) continue
    bestDist = d
    best = arena.id
  }
  return best
}

export function sortArenasByDistance(
  arenas: SportArenaOption[],
  gps: { lat: number; lng: number },
): SportArenaOption[] {
  return [...arenas].sort((a, b) => {
    const da = arenaDistanceSq(a, gps)
    const db = arenaDistanceSq(b, gps)
    if (da == null && db == null) return a.name.localeCompare(b.name)
    if (da == null) return 1
    if (db == null) return -1
    return da - db || a.name.localeCompare(b.name)
  })
}

export function filterArenasByQuery(arenas: SportArenaOption[], query: string): SportArenaOption[] {
  const q = query.trim().toLowerCase()
  if (!q) return arenas
  return arenas.filter((a) => a.name.toLowerCase().includes(q))
}

export function ensureArenaInList(arenas: SportArenaOption[], arena: SportArenaOption): SportArenaOption[] {
  if (arenas.some((a) => a.id === arena.id)) return arenas
  return [arena, ...arenas]
}

export function applyNearestArenaToPicker(
  arenas: SportArenaOption[],
  nearest: SportArenaOption | null,
): { arenas: SportArenaOption[]; sportArenaId: string } | null {
  if (!nearest?.id) return null
  return {
    arenas: ensureArenaInList(arenas, nearest),
    sportArenaId: nearest.id,
  }
}
