import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { MessageCircle, X } from 'lucide-react'
import { BRAND_EN } from '../../lib/brand'
import { normalizePhone, toWhatsAppUrl } from '../../lib/phone'
import { formatCurrency } from '../../lib/retail'

type ShareCoupon = {
  code: string
  percentage: number
  min_order_value: number
  expiry_date: string | null
}

function defaultMessage(coupon: ShareCoupon) {
  const details = [
    `🎟 Coupon Code: ${coupon.code}`,
    `${coupon.percentage}% OFF`,
    ...(coupon.min_order_value > 0 ? [`Minimum purchase: ${formatCurrency(coupon.min_order_value)}`] : []),
    ...(coupon.expiry_date ? [`Expiry date: ${new Date(coupon.expiry_date).toLocaleDateString('en-IN')}`] : []),
  ]
  return `Hello! 👋\n\nWelcome to ${BRAND_EN}!\n\nWe have a special offer for you.\n\n${details.join('\n')}\n\nUse this coupon on your purchase and enjoy your special discount.\n\nWe look forward to seeing you!\n\n– ${BRAND_EN}`
}

export function CouponShareModal({ coupon, onClose }: { coupon: ShareCoupon; onClose: () => void }) {
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState(() => defaultMessage(coupon))
  const [error, setError] = useState('')
  const dialogRef = useRef<HTMLFormElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    phoneRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose() }
      if (event.key !== 'Tab') return
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button, input, textarea') || [])
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); previous?.focus() }
  }, [onClose])

  const send = (event: FormEvent) => {
    event.preventDefault()
    const clean = normalizePhone(phone)
    if (!clean) { setError('Enter a valid 10-digit mobile number.'); phoneRef.current?.focus(); return }
    if (!message.trim()) { setError('Enter a message before sending.'); return }
    setError('')
    window.open(toWhatsAppUrl(clean, message), '_blank', 'noopener,noreferrer')
  }

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-3 sm:p-6" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <form ref={dialogRef} onSubmit={send} role="dialog" aria-modal="true" aria-labelledby="coupon-share-title"
        className="max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 sm:p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id="coupon-share-title" className="text-lg font-black text-[#111111]">Share Coupon</h3>
            <p className="break-all text-[13px] font-bold text-emerald-700">{coupon.code}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close coupon sharing" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"><X size={20} /></button>
        </div>
        <label className="mb-4 block">
          <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-[#6B7280]">Customer Mobile Number</span>
          <input ref={phoneRef} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={e => { setPhone(e.target.value); setError('') }} placeholder="Enter 10-digit mobile number" aria-invalid={!!error} aria-describedby={error ? 'coupon-share-error' : undefined}
            className="h-11 w-full min-w-0 rounded-xl border border-gray-200 px-3 text-base font-semibold focus:outline-none focus:border-primary-soft" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-[#6B7280]">Customize Message</span>
          <textarea rows={6} value={message} onChange={e => { setMessage(e.target.value); setError('') }}
            className="w-full min-w-0 rounded-xl border border-gray-200 p-3 text-base sm:text-[13px] font-semibold text-[#111111] focus:outline-none focus:border-primary-soft" />
        </label>
        <div className="mt-4 rounded-xl border border-green-200 bg-[#F3F9F1] p-3 sm:p-4">
          <p className="mb-2 text-[10px] font-black uppercase text-[#6B7280]">Message Preview</p>
          <p className="whitespace-pre-wrap break-words text-[13px] text-[#111111] [overflow-wrap:anywhere]">{message}</p>
        </div>
        {error && <p id="coupon-share-error" role="alert" className="mt-3 text-[13px] font-bold text-red-600">{error}</p>}
        <p className="mt-3 text-xs text-gray-500">Opens WhatsApp with your message. You choose when to send it there.</p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-gray-200 px-4 text-[12px] font-black">Cancel</button>
          <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-[12px] font-black text-white hover:bg-emerald-700"><MessageCircle size={17} /> Send Coupon</button>
        </div>
      </form>
    </div>, document.body,
  )
}
