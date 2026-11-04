import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { CouponVoucher, type CouponOffer } from '../components/coupons/CouponVoucher'

/** Renders the landscape coupon ticket into a single-page PDF sized exactly to the artwork. */
export async function couponPdf(coupon: CouponOffer, opts: { restricted?: boolean; customerName?: string } = {}): Promise<File> {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-10000px;top:0;display:inline-block;padding:18px;background:#fff;box-sizing:content-box;'
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    flushSync(() => root.render(<CouponVoucher coupon={coupon} layout="print" restricted={opts.restricted} customerName={opts.customerName} />))
    await document.fonts.ready
    await Promise.all(Array.from(host.querySelectorAll('img')).map(img => img.decode().catch(() => undefined)))
    const canvas = await html2canvas(host, { windowWidth:1024, scale: 2.5, backgroundColor: '#ffffff', useCORS: true, logging: false })
    // A mini ticket, 148 mm wide; height follows the content so longer codes never crop.
    const width = 148, height = width * canvas.height / canvas.width
    const pdf = new jsPDF({ unit: 'mm', format: [width, height], orientation: 'landscape', compress: true })
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, width, height)
    return new File([pdf.output('blob')], `coupon-${coupon.code.replace(/[^a-z0-9_-]/gi, '_')}.pdf`, { type: 'application/pdf' })
  } finally { root.unmount(); host.remove() }
}

export function downloadCouponFile(file: File) {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url; link.download = file.name
  document.body.appendChild(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
