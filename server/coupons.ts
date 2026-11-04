import { readFile } from 'node:fs/promises'
import { query } from './db.js'
import { ApiError } from './query.js'

export async function publicCoupon(raw: string) {
  const code = raw.trim().toUpperCase()
  if (!code || code.length > 100) throw new ApiError('Coupon not found', '404', 404)
  const result = await query<{ code:string; percentage:number; min_order_value:number; expiry_date:string|null; is_active:boolean; usage_limit:number|null; usage_count:number }>('SELECT code, percentage, min_order_value, expiry_date, is_active, usage_limit, usage_count FROM public.coupons WHERE upper(btrim(code)) = $1', [code])
  const row = result.rows[0]
  if (!row) throw new ApiError('Coupon not found', '404', 404)
  const available = row.is_active && (!row.expiry_date || new Date(row.expiry_date) >= new Date()) && (!row.usage_limit || row.usage_count < row.usage_limit)
  return { code: row.code, percentage: Number(row.percentage), min_order_value: Number(row.min_order_value), expiry_date: row.expiry_date, available: !!available }
}
const escapeHtml = (s: unknown) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
export async function couponHtml(code: string) {
  const coupon = await publicCoupon(code)
  const origin = 'https://error404-pos.vercel.app'
  const title = 'Your Coupon from ERROR 404'
  const description = coupon.available ? `${coupon.percentage}% OFF · Code ${coupon.code}. View and download your ERROR 404 coupon. Checked at billing.` : 'This ERROR 404 coupon is no longer available.'
  const url = `${origin}/coupon/${encodeURIComponent(coupon.code)}`
  const template = await readFile(`${process.cwd()}/dist/index.html`, 'utf8')
  return template.replace(/<title>[\s\S]*?<\/title>/i, '').replace(/<meta\b[^>]*(?:property=["']og:|name=["'](?:twitter:|description["']))[^>]*>/gi, '').replace('</head>', `<title>${title}</title><meta name="description" content="${escapeHtml(description)}"><meta property="og:type" content="website"><meta property="og:title" content="${title}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(url)}"><meta property="og:image" content="${origin}/error404-icon-512.png"><meta name="twitter:card" content="summary"><meta name="robots" content="noindex"></head>`)
}
