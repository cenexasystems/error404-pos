import { BRAND_EN, BRAND_PRODUCTION_DOMAIN } from './brand'
import { formatCurrency } from './retail'
import { db } from './db'

/**
 * Customer-specific coupons, stored in the database (migration 0038):
 *   coupons.restrict_to_recipients  +  coupon_recipients (one row per coupon + phone).
 * Billing rejects a restricted coupon for any phone that is not a recipient (POS check + database trigger).
 */
export type CouponSendStats = { phones: string[]; sent: number }

/** All recipients grouped by coupon code. `ready` is false until the database update has been applied. */
export async function fetchCouponRecipients(): Promise<{ ready: boolean; byCode: Map<string, CouponSendStats> }> {
  const byCode = new Map<string, CouponSendStats>()
  const { data, error } = await db.from('coupon_recipients').select('coupon_code, phone, sent_count')
  if (error) return { ready: false, byCode }
  for (const row of (data || []) as { coupon_code: string; phone: string; sent_count: number }[]) {
    const cur = byCode.get(row.coupon_code) || { phones: [], sent: 0 }
    cur.phones.push(row.phone); cur.sent += Number(row.sent_count || 0)
    byCode.set(row.coupon_code, cur)
  }
  return { ready: true, byCode }
}

/** Records that the coupon was sent to this phone (counts repeat sends). */
export async function recordCouponSend(code: string, phone10: string, customerName = '') {
  const { error } = await db.rpc('record_coupon_send', { p_code: code.trim().toUpperCase(), p_phone: phone10, p_customer_name: customerName.trim() })
  if (error) throw new Error(error.message || 'Could not record the coupon send')
}

export async function setCouponRestricted(couponId: number, restricted: boolean) {
  const { error } = await db.from('coupons').update({ restrict_to_recipients: restricted }).eq('id', couponId)
  if (error) throw new Error(error.message || 'Could not update the coupon')
}

/** Billing check for customer-only coupons. Returns an error message, or null when the phone may use it. */
export async function checkCouponRecipient(code: string, restricted: boolean, phone: string): Promise<string | null> {
  if (!restricted) return null
  const phone10 = phone.replace(/\D/g, '').slice(-10)
  if (phone10.length !== 10) return 'Only for the customer it was sent to — enter their mobile number first'
  const { data, error } = await db.from('coupon_recipients').select('id').eq('coupon_code', code.trim().toUpperCase()).eq('phone', phone10).limit(1)
  if (error) return 'Could not check this coupon. Try again.'
  return (data || []).length ? null : 'Not valid for this mobile number'
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
export function couponTerms(c: CouponLinkData, restricted = false, lockedTo = '') {
  return [
    c.min_order_value > 0 ? `Minimum purchase ${formatCurrency(c.min_order_value)}` : 'On any purchase',
    ...(c.expiry_date ? [`Valid till ${couponExpiry(c.expiry_date)}`] : []),
    ...(restricted ? [lockedTo.trim() ? `Only for ${lockedTo.trim().slice(0, 40)}` : 'Only for the mobile number it was sent to'] : []),
  ]
}

