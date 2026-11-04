import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { CouponVoucher, type CouponOffer } from '../components/coupons/CouponVoucher'

export async function couponPdf(coupon: CouponOffer): Promise<File> {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;padding:20px;background:white;box-sizing:border-box;'
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    flushSync(() => root.render(<CouponVoucher coupon={coupon}/>))
    await document.fonts.ready
    await Promise.all(Array.from(host.querySelectorAll('img')).map(img => img.complete ? null : new Promise(resolve => { img.onload = img.onerror = resolve })))
    const canvas = await html2canvas(host, { windowWidth:1024, scale:2, backgroundColor:'#fff', useCORS:true, logging:false })
    const width = 210, height = width * canvas.height / canvas.width
    const pdf = new jsPDF({ unit:'mm', format:[width,height], orientation:width >= height ? 'landscape' : 'portrait' })
    pdf.addImage(canvas.toDataURL('image/png'),'PNG',0,0,width,height)
    return new File([pdf.output('blob')], `Coupon-${coupon.code.replace(/[^a-z0-9_-]/gi,'_')}.pdf`, { type:'application/pdf' })
  } finally { root.unmount(); host.remove() }
}

export function downloadCouponFile(file: File) {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url; link.download = file.name; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
