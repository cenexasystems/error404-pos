import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Download, MessageCircle, X } from 'lucide-react'
import { couponPdf, downloadCouponFile } from '../../lib/couponPdf'
import { couponBrand, couponExpiry, couponPublicUrl, recordCouponSend } from '../../lib/couponSends'
import { normalizePhone, toWhatsAppUrl } from '../../lib/phone'
import { formatCurrency } from '../../lib/retail'

type ShareCoupon = { code: string; percentage: number; min_order_value: number; expiry_date: string | null }

function buildMessage(c: ShareCoupon, name: string, link: string, restricted: boolean) {
  const brand = couponBrand()
  const validity = c.expiry_date ? ` (valid till ${couponExpiry(c.expiry_date)})` : ''
  const lines = [
    `Hi ${name.trim() || 'there'}! 🎁`,
    `Here's a *${c.percentage}% OFF* coupon from *${brand}*${validity}.`,
    '',
    `Code: *${c.code}*`,
    ...(c.min_order_value > 0 ? [`Minimum purchase: ${formatCurrency(c.min_order_value)}`] : []),
    ...(restricted ? ['Valid only for this mobile number.'] : []),
    'Show it at billing to claim your offer.',
    '',
    'Download Your Coupon:',
    link,
  ]
  return lines.join('\n')
}

export function CouponShareModal({ coupon, onClose, onSent }: { coupon: ShareCoupon; onClose: () => void; onSent?: () => void }) {
  const [phone, setPhone] = useState('')
  const [customerName, setCustomerName] = useState('')
  const onlyThisCustomer = false
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const dialogRef = useRef<HTMLFormElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    phoneRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose() }
      if (event.key !== 'Tab') return
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button, input') || []).filter(el => el.getClientRects().length > 0 && !el.hasAttribute('disabled'))
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); previous?.focus() }
  }, [onClose])

  const cleanPhone = normalizePhone(phone)
  const link = couponPublicUrl(coupon, { customerName })
  const message = buildMessage(coupon, customerName, link, onlyThisCustomer)

  // Pre-build the PDF while the dialog is open so "Generate & share PDF" can call the share sheet
  // straight from the click (browsers reject navigator.share once the click's activation has expired).
  const pdfKey = JSON.stringify([coupon, customerName.trim(), onlyThisCustomer])
  const pdfCache = useRef<{ key: string; file: Promise<File> } | null>(null)
  const getPdf = useCallback(() => {
    if (pdfCache.current?.key !== pdfKey) {
      const file = couponPdf(coupon, { restricted: onlyThisCustomer, customerName })
      file.catch(() => { if (pdfCache.current?.file === file) pdfCache.current = null })
      pdfCache.current = { key: pdfKey, file }
    }
    return pdfCache.current.file
  }, [coupon, customerName, onlyThisCustomer, pdfKey])
  useEffect(() => {
    const t = setTimeout(() => { void getPdf().catch(() => {}) }, 600)
    return () => clearTimeout(t)
  }, [getPdf])
  const [readyFile, setReadyFile] = useState<File | null>(null)
  useEffect(() => { setReadyFile(null) }, [pdfKey])


  const sendWhatsApp = (event: FormEvent) => {
    event.preventDefault()
    if (!cleanPhone) { setError('Enter a valid 10-digit WhatsApp number.'); phoneRef.current?.focus(); return }
    setError('')
    window.open(toWhatsAppUrl(cleanPhone, message), '_blank', 'noopener,noreferrer')
    recordCouponSend(coupon.code, cleanPhone); onSent?.()
    setNotice('WhatsApp opened with the coupon link.')
  }

  const canShareFiles = (() => {
    try { return !!navigator.canShare?.({ files: [new File([''], 'coupon.pdf', { type: 'application/pdf' })] }) } catch { return false }
  })()

  const shareFile = async (file: File) => {
    await navigator.share({ files: [file], text: message, title: `Coupon ${coupon.code}` })
    if (cleanPhone) { recordCouponSend(coupon.code, cleanPhone); onSent?.() }
    setReadyFile(null)
    setNotice('Coupon PDF shared.')
  }

  const sharePdf = async () => {
    if (phone.trim() && !cleanPhone) { setError('Enter a valid 10-digit WhatsApp number, or leave it empty to download.'); phoneRef.current?.focus(); return }
    setError(''); setNotice(''); setBusy(true)
    try {
      const file = await getPdf()
      downloadCouponFile(file)
      setNotice('Coupon PDF downloaded. You can also share the coupon link below.')
      if (canShareFiles) {
        try { await shareFile(file) }
        catch (err) {
          if (err instanceof Error && err.name === 'AbortError') { setNotice('Sharing cancelled. Your PDF has been downloaded.'); return }
          setReadyFile(file); setNotice('PDF downloaded. Tap Share PDF now to open your device sharing options, or use the coupon link below.')
        }
      }
    } catch { setError('Could not create the coupon PDF. Please try again.') }
    finally { setBusy(false) }
  }
  const label = 'mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#111111]'
  const input = 'h-12 w-full rounded-xl border border-transparent bg-[#F7F5F2] px-4 text-[14px] text-[#111111] outline-none transition-colors placeholder:text-gray-400 focus:border-[#E5B94E] focus:bg-[#FFFBF0] focus:ring-2 focus:ring-[#FDE7A7]'

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <form ref={dialogRef} onSubmit={sendWhatsApp} role="dialog" aria-modal="true" aria-labelledby="coupon-share-title" noValidate
        className="max-h-[94dvh] w-full max-w-[480px] overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <h3 id="coupon-share-title" className="min-w-0 text-[15px] font-bold text-[#111111]">
            Send coupon · <span className="break-all font-mono tracking-wider">{coupon.code}</span>
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"><X size={18} /></button>
        </div>

        <div className="space-y-5 px-5 pb-5 pt-4">
          <p className="text-[12px] leading-relaxed text-gray-500">
            Send a personalized coupon link on WhatsApp, or download the PDF and use your device's sharing options when available.
          </p>

          <div>
            <label htmlFor="coupon-share-phone" className={label}>Customer phone <span className="text-red-500">*</span></label>
            <input id="coupon-share-phone" ref={phoneRef} type="tel" inputMode="tel" autoComplete="tel" placeholder="Enter WhatsApp number"
              value={phone} onChange={e => { setPhone(e.target.value); setError(''); setNotice('') }} className={input} />
          </div>

          <div>
            <label htmlFor="coupon-share-name" className={label}>Customer name</label>
            <input id="coupon-share-name" type="text" autoComplete="name" placeholder="Optional" maxLength={40}
              value={customerName} onChange={e => setCustomerName(e.target.value)} className={input} />
          </div>

          <div className="flex items-center justify-between gap-4">
            <span id="coupon-only-label" className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#111111]">Only for this customer</span>
            <button type="button" role="switch" disabled aria-checked={false} aria-labelledby="coupon-only-label" aria-describedby="coupon-eligibility-note"
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${onlyThisCustomer ? 'bg-emerald-600' : 'bg-gray-300'}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${onlyThisCustomer ? 'left-6' : 'left-1'}`} />
            </button>
          </div>

          <p id="coupon-eligibility-note" className="text-xs leading-relaxed text-gray-500">Customer-only restrictions are not enabled. Sharing with a customer does not change this coupon's existing eligibility rules.</p>

          {readyFile && (
            <div className="grid grid-cols-2 gap-2.5">
              <button type="button" onClick={() => void shareFile(readyFile).catch(err => { if (!(err instanceof Error && err.name === 'AbortError')) setError('Sharing is not available here — use Download PDF.') })}
                className="h-11 rounded-xl bg-emerald-500 text-[12px] font-bold text-white hover:bg-emerald-600">Share PDF now</button>
              <button type="button" onClick={() => { downloadCouponFile(readyFile); setReadyFile(null); setNotice(`${readyFile.name} downloaded.`) }}
                className="h-11 rounded-xl border border-gray-300 bg-white text-[12px] font-bold text-[#111111] hover:bg-gray-50">Download PDF</button>
            </div>
          )}
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] font-semibold text-red-700">{error}</p>}
          {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[12px] font-semibold text-emerald-700">{notice}</p>}
          <a href={link} target="_blank" rel="noopener noreferrer" className="block break-all text-xs font-semibold text-emerald-700 underline">Download Your Coupon: {link}</a>

          <div className="grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-3">
            <button type="button" onClick={onClose} className="h-12 rounded-xl border border-gray-300 bg-white text-[13px] font-bold text-[#111111] hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={!cleanPhone}
              className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-2 text-[12px] font-bold leading-tight text-white transition-colors hover:bg-emerald-600 disabled:bg-emerald-300">
              <MessageCircle size={15} className="shrink-0" /> Send link on WhatsApp
            </button>
            <button type="button" disabled={busy} onClick={() => void sharePdf()}
              className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-2 text-[12px] font-bold leading-tight text-emerald-600 transition-colors hover:bg-emerald-50 disabled:opacity-60">
              <Download size={15} className="shrink-0" /> {busy ? 'Preparing…' : 'Generate & share PDF'}
            </button>
          </div>
        </div>
      </form>
    </div>, document.body,
  )
}
