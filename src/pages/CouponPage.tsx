import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { CouponVoucher, type CouponOffer } from '../components/coupons/CouponVoucher'
import { couponPdf, downloadCouponFile } from '../lib/couponPdf'
import { BRAND_WHATSAPP_LINK } from '../lib/brand'

type PublicCoupon = CouponOffer & { available: boolean; restricted?: boolean }
export default function CouponPage() {
  const { code = '' } = useParams()
  const [params] = useSearchParams()
  const name = (params.get('n') || '').slice(0, 40)
  const [coupon, setCoupon] = useState<PublicCoupon | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    document.title = 'Your Coupon from ERROR 404'
    setLoading(true); setCoupon(null); setError(''); setNotFound(false)
    fetch(`/api/coupon?code=${encodeURIComponent(code)}`, { signal:controller.signal }).then(async response => {
      if (response.status === 404) { setNotFound(true); return }
      if (!response.ok) throw new Error('Could not load your coupon right now. Please try again in a moment.')
      const result = await response.json(); setCoupon(result.data)
    }).catch(err => { if (err.name !== 'AbortError') setError(err.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [code])
  async function download() {
    if (!coupon) return
    setBusy(true); setError('')
    try { downloadCouponFile(await couponPdf(coupon, { restricted:coupon.restricted, customerName:name })) }
    catch { setError('Could not download your coupon. Please try again.') }
    finally { setBusy(false) }
  }
  return <main className="h-[100dvh] overflow-y-auto bg-[#F1F4F8] px-4 py-10 sm:py-16">
    <div className="mx-auto w-full max-w-[420px] space-y-4">
      {loading ? <p role="status">Loading your coupon…</p> : coupon?.available ? <>
        <CouponVoucher coupon={coupon} layout="card" customerName={name} restricted={coupon.restricted}/>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => void download()} disabled={busy} className="min-h-12 rounded-xl bg-[#353d21] px-3 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Preparing…' : 'Download PDF'}</button>
          <a href={BRAND_WHATSAPP_LINK} className="flex min-h-12 items-center justify-center rounded-xl border bg-white text-sm font-bold">Chat with shop</a>
        </div>
        <p className="text-center text-xs text-gray-500">Coupon validity and eligibility are checked at billing.</p>
      </> : !error && <div className="rounded-[22px] bg-white p-7 text-center shadow-[0_20px_45px_-25px_rgba(17,24,39,.45)]">
        <p className="text-[12px] font-extrabold tracking-[0.2em] text-[#556b2f]">ERROR 404</p>
        <h1 className="mt-3 text-xl font-extrabold text-[#1b1f14]">{notFound ? 'Coupon not found' : 'This coupon is no longer available'}</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-gray-500">{notFound ? "This coupon doesn't exist any more." : 'It may have expired, been paused or reached its usage limit.'} Please contact ERROR 404 for current offers.</p>
        {BRAND_WHATSAPP_LINK && <a href={BRAND_WHATSAPP_LINK} className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#353d21] text-sm font-bold text-white">Chat with shop</a>}
      </div>}
      {error && <p role="alert" className="rounded-xl bg-white p-4 text-sm text-red-700">{error}</p>}
    </div>
  </main>
}
