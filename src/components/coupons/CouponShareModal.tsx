import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, MessageCircle, X } from 'lucide-react'
import { couponPdf, downloadCouponFile } from '../../lib/couponPdf'
import { couponBrand, couponExpiry, couponPublicUrl, recordCouponSend, setCouponRestricted } from '../../lib/couponSends'
import { toWhatsAppUrl } from '../../lib/phone'
import { formatCurrency } from '../../lib/retail'

type ShareCoupon = {
  id: number; code: string; percentage: number; min_order_value: number; expiry_date: string | null
  restrict_to_recipients?: boolean
}

/** Same structure as the reference: greeting, offer line, code, how to use — then the link on its own line. */
function couponMessage(c: ShareCoupon, name: string) {
  const terms = [c.min_order_value > 0 ? `on orders of ${formatCurrency(c.min_order_value)}+` : '', c.expiry_date ? `valid till ${couponExpiry(c.expiry_date)}` : '']
    .filter(Boolean).join(', ')
  return [
    `Hi${name ? ` ${name}` : ''}! 🎉`,
    `Here's a *${c.percentage}% OFF* coupon from *${couponBrand()}*${terms ? ` (${terms})` : ''}.`,
    '',
    `Code: *${c.code}*`,
    'Show it at billing to claim your offer.',
  ]
}

export function CouponShareModal({ coupon, phonesSoFar = 0, ready = true, onClose, onSent }: {
  coupon: ShareCoupon; phonesSoFar?: number; ready?: boolean; onClose: () => void; onSent?: () => void
}) {
  const [phone, setPhone] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [onlyThisCustomer, setOnlyThisCustomer] = useState(!!coupon.restrict_to_recipients)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [readyFile, setReadyFile] = useState<File | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
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

  const validPhone = /^[6-9]\d{9}$/.test(phone)
  const name = customerName.trim()
  const link = couponPublicUrl(coupon, { customerName: name })
  const lines = couponMessage(coupon, name)
  const linkMessage = [...lines, '', 'Download your coupon:', link].join('\n')
  const lockedTo = onlyThisCustomer ? (name || phone) : ''

  // The PDF is rendered ahead of the click so the share sheet opens inside the click (browsers block it later).
  const pdfKey = JSON.stringify([coupon.code, name, lockedTo, onlyThisCustomer])
  const pdfCache = useRef<{ key: string; file: Promise<File> } | null>(null)
  const getPdf = useCallback(() => {
    if (pdfCache.current?.key !== pdfKey) {
      const file = couponPdf(coupon, { restricted: onlyThisCustomer, customerName: name || undefined, lockedTo })
      file.catch(() => { if (pdfCache.current?.file === file) pdfCache.current = null })
      pdfCache.current = { key: pdfKey, file }
    }
    return pdfCache.current.file
  }, [coupon, name, lockedTo, onlyThisCustomer, pdfKey])
  useEffect(() => {
    if (!validPhone) return
    const t = setTimeout(() => { void getPdf().catch(() => {}) }, 500)
    return () => clearTimeout(t)
  }, [getPdf, validPhone])
  useEffect(() => { setReadyFile(null) }, [pdfKey])

  /** Saves the send (and the customer-only choice) after the chat / share sheet has been used. */
  const record = async (via: string) => {
    if (!ready) { setNotice(via === 'WhatsApp' ? 'WhatsApp opened with the coupon link.' : 'Coupon PDF ready.'); return }
    try {
      await recordCouponSend(coupon.code, phone, name)
      if (onlyThisCustomer !== !!coupon.restrict_to_recipients) await setCouponRestricted(coupon.id, onlyThisCustomer)
      onSent?.()
      setNotice(`${coupon.code} sent to ${name || phone} (${via}).`)
    } catch (err) {
      setError(`${via === 'WhatsApp' ? 'WhatsApp opened' : 'Coupon shared'}, but it could not be recorded: ${err instanceof Error ? err.message : 'try again'}.`)
    }
  }

  const sendWhatsApp = async () => {
    if (!validPhone || busy) return
    setError(''); setNotice('')
    window.open(toWhatsAppUrl(phone, linkMessage), '_blank', 'noopener,noreferrer')
    setBusy(true); await record('WhatsApp'); setBusy(false)
  }

  const canShareFiles = (() => {
    try { return !!navigator.canShare?.({ files: [new File([''], 'coupon.pdf', { type: 'application/pdf' })] }) } catch { return false }
  })()

  const shareFile = async (file: File) => {
    await navigator.share({ files: [file], text: lines.join('\n'), title: `Coupon ${coupon.code}` })
    setReadyFile(null)
    await record('PDF')
  }

  const sharePdf = async () => {
    if (!validPhone || busy) return
    setError(''); setNotice('')
    // No file sharing (most desktops): open the chat tab inside the click so pop-up blockers allow it.
    const waTab = canShareFiles ? null : window.open('', '_blank')
    setBusy(true)
    try {
      const file = await getPdf()
      if (canShareFiles) {
        try { await shareFile(file) }
        catch (err) {
          if (err instanceof Error && err.name === 'AbortError') return
          setReadyFile(file); setNotice('The PDF is ready — tap "Share PDF now".')
        }
        return
      }
      downloadCouponFile(file)
      const url = toWhatsAppUrl(phone, lines.join('\n'))
      if (waTab && !waTab.closed) waTab.location.href = url
      else window.open(url, '_blank', 'noopener,noreferrer')
      await record('PDF')
      setNotice(n => `${n} ${file.name} downloaded — attach it in the WhatsApp chat.`.trim())
    } catch {
      waTab?.close()
      setError("Couldn't make the PDF. Please try again.")
    } finally { setBusy(false) }
  }

  const label = 'mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#111111]'
  const input = 'h-12 w-full rounded-xl border border-transparent bg-[#F7F5F2] px-4 text-[14px] text-[#111111] outline-none transition-colors placeholder:text-gray-400 focus:border-[#E5B94E] focus:bg-[#FFFBF0] focus:ring-2 focus:ring-[#FDE7A7]'

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="coupon-share-title"
        className="max-h-[94dvh] w-full max-w-[480px] overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <h3 id="coupon-share-title" className="min-w-0 text-[15px] font-bold text-[#111111]">
            Send coupon · <span className="break-all font-mono tracking-wider">{coupon.code}</span>
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"><X size={18} /></button>
        </div>

        <div className="space-y-5 px-5 pb-5 pt-4">
          <p className="text-[12px] leading-relaxed text-gray-500">
            The coupon goes as a download link in the customer's WhatsApp chat, or as a PDF with "Generate &amp; share PDF". It is recorded once the chat or share sheet has been used.
          </p>

          <div>
            <label htmlFor="coupon-share-phone" className={label}>Customer phone <span className="text-red-500">*</span></label>
            <input id="coupon-share-phone" ref={phoneRef} type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="Enter WhatsApp number"
              value={phone} onChange={e => { setPhone(e.target.value.replace(/\D/g, '').slice(-10)); setError(''); setNotice('') }} className={input} />
            {phone && !validPhone && <span className="mt-1 block text-[11.5px] font-semibold text-amber-600">Enter a 10-digit mobile number.</span>}
          </div>

          <div>
            <label htmlFor="coupon-share-name" className={label}>Customer name</label>
            <input id="coupon-share-name" type="text" autoComplete="name" placeholder="Optional" maxLength={40}
              value={customerName} onChange={e => setCustomerName(e.target.value)} className={input} />
          </div>

          <div className="flex items-center justify-between gap-4">
            <span id="coupon-only-label" className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#111111]">Only for this customer</span>
            <button type="button" role="switch" aria-checked={onlyThisCustomer} aria-labelledby="coupon-only-label" disabled={!ready}
              onClick={() => setOnlyThisCustomer(v => !v)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${onlyThisCustomer ? 'bg-emerald-600' : 'bg-gray-300'}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${onlyThisCustomer ? 'left-6' : 'left-1'}`} />
            </button>
          </div>

          {!ready ? (
            <p className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[12px] font-semibold text-gray-600">Customer-only coupons need the coupon database update (migration 0038). Until it is applied, sends are not recorded.</p>
          ) : onlyThisCustomer ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] font-semibold text-amber-800">
              This coupon will only work for the phones it was sent to{phonesSoFar ? ` (${phonesSoFar} so far)` : ''}. Use a dedicated coupon for this.
            </p>
          ) : coupon.restrict_to_recipients && (
            <p className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-[12px] font-semibold text-sky-700">Sending with this off opens {coupon.code} to every customer again.</p>
          )}

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

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <button type="button" onClick={onClose} className="h-12 rounded-xl border border-gray-300 bg-white text-[13px] font-bold text-[#111111] hover:bg-gray-50">Cancel</button>
            <button type="button" disabled={!validPhone || busy} onClick={() => void sendWhatsApp()}
              className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-2 text-[12px] font-bold leading-tight text-white transition-colors hover:bg-emerald-600 disabled:opacity-45">
              <MessageCircle size={15} className="shrink-0" /> Send link on WhatsApp
            </button>
            <button type="button" disabled={!validPhone || busy} onClick={() => void sharePdf()}
              className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-emerald-400 bg-white px-2 text-[12px] font-bold leading-tight text-emerald-600 transition-colors hover:bg-emerald-50 disabled:opacity-45">
              <Download size={15} className="shrink-0" /> {busy ? 'Working…' : 'Generate & share PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>, document.body,
  )
}
