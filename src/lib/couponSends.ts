import { BRAND_EN, BRAND_PRODUCTION_DOMAIN } from './brand'
import { formatCurrency } from './retail'

/**
 * Device-local record of who a coupon was sent to (for the "sent N×" / "only N phones" badges).
 * Stored in this browser only — no database tables are involved.
 */
type SendRecord = { phones: string[]; count: number; restricted: boolean }
const KEY = 'error404:coupon-sends:v1'

function readAll(): Record<string, SendRecord> {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {} } catch { return {} }
}
function writeAll(all: Record<string, SendRecord>) {
  try { localStorage.setItem(KEY, JSON.stringify(all)) } catch { /* storage unavailable */ }
}

export function getCouponSends(code: string): SendRecord {
  const rec = readAll()[code.trim().toUpperCase()]
  return { phones: rec?.phones || [], count: rec?.count || 0, restricted: !!rec?.restricted }
}

export function setCouponRestricted(code: string, restricted: boolean) {
  const all = readAll(); const k = code.trim().toUpperCase()
  all[k] = { ...getCouponSends(k), restricted }
  writeAll(all)
}

export function recordCouponSend(code: string, phone: string) {
  const all = readAll(); const k = code.trim().toUpperCase()
  const cur = getCouponSends(k)
  all[k] = { ...cur, count: cur.count + 1, phones: cur.phones.includes(phone) ? cur.phones : [...cur.phones, phone] }
  writeAll(all)
}

export type CouponLinkData = { code: string; percentage: number; min_order_value: number; expiry_date: string | null }

/** Base URL for links sent to customers: the live site, never localhost or a LAN address. */
export function publicAppOrigin(): string {
  const fallback = new URL(BRAND_PRODUCTION_DOMAIN).origin
  try {
    const { protocol, hostname, origin } = window.location
    const local = /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname) || hostname.endsWith('.local')
    return protocol === 'https:' && !local ? origin : fallback
  } catch { return fallback }
}

/**
 * Public coupon URL. Offer data is loaded from the server; a supplied display name
 * personalizes the gift. Phone numbers and eligibility never travel in the URL.
 */
export function couponPublicUrl(c: CouponLinkData, opts: { customerName?: string } = {}) {
  const name = opts.customerName?.trim().slice(0, 40)
  return `${publicAppOrigin()}/coupon/${encodeURIComponent(c.code.trim().toUpperCase())}${name ? `?n=${encodeURIComponent(name)}` : ''}`
}

export const couponBrand = () => (BRAND_EN || 'ERROR 404').toUpperCase()
export const couponExpiry = (d: string | null) => d ? new Date(d).toLocaleDateString('en-IN') : ''
export function couponTerms(c: CouponLinkData, restricted = false) {
  return [
    c.min_order_value > 0 ? `Minimum purchase ${formatCurrency(c.min_order_value)}` : 'On any purchase',
    ...(c.expiry_date ? [`Valid till ${couponExpiry(c.expiry_date)}`] : []),
    ...(restricted ? ['Only for the number it was sent to'] : []),
  ]
}

