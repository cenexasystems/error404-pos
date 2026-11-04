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
  useEffect(() => {
    const controller = new AbortController()
    document.title = 'Your Coupon from ERROR 404'
    setLoading(true); setCoupon(null); setError('')
    fetch(`/api/coupon?code=${encodeURIComponent(code)}`, { signal:controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Coupon not found or temporarily unavailable. Please contact the shop.')
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
      </> : !error && <div className="rounded-2xl bg-white p-6"><h1 className="font-bold">This coupon is no longer available</h1><p className="mt-2 text-sm">Please contact ERROR 404 for current offers.</p></div>}
      {error && <p role="alert" className="rounded-xl bg-white p-4 text-sm text-red-700">{error}</p>}
    </div>
  </main>
}
