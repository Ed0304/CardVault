/** Formats an ISO timestamp as e.g. "7 Nov 2026". Empty string if invalid. */
export const formatDate = (iso?: string | null): string => {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

/** Short, display-only form of a card id, used as a catalog number. */
export const shortId = (id: string): string => id.slice(0, 8).toUpperCase()

/** Hostname of a URL without "www.", or null if it cannot be parsed. */
export const hostnameOf = (url?: string | null): string | null => {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}
