import type { HomeCardViewModel } from "./buildHomeCards"

/** Prefer happening-now card; otherwise expand the first card. */
export function defaultExpandedCardId(cards: HomeCardViewModel[]): string | null {
  if (cards.length === 0) return null
  const happening = cards.find((c) => c.hasHappeningNow)
  return happening?.id ?? cards[0]!.id
}

export function initialExpandedCardIds(cards: HomeCardViewModel[]): Set<string> {
  const id = defaultExpandedCardId(cards)
  return id ? new Set([id]) : new Set()
}
