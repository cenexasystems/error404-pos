import { couponBrand, couponTerms } from '../../lib/couponSends'
import { BRAND_PRINT_LOGO } from '../../lib/brand'
import type { CouponLinkData } from '../../lib/couponSends'
export type CouponOffer = CouponLinkData
const OLIVE = '#526035'
export function CouponVoucher({ coupon, layout = 'card', restricted = false, customerName }: {
  coupon: CouponOffer; layout?: 'card' | 'print' | 'preview'; restricted?: boolean; customerName?: string
}) {
  const print = layout === 'print'
  const terms = couponTerms(coupon, restricted)
  const greeting = customerName?.trim() ? `A gift for ${customerName.trim().slice(0,40)}` : 'A gift for you'
  return <div data-coupon-voucher style={{ display:'flex', flexDirection:print ? 'row' : 'column', width:print ? 760 : '100%', minHeight:print ? 400 : undefined, borderRadius:22, overflow:'hidden', background:'#151d18', color:'#fff', fontFamily:'Arial, sans-serif', border:'1px solid #8c99684d' }}>
    <div style={{ flex:1, minWidth:0, padding:print ? '28px 32px' : 26 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ padding:4, borderRadius:10, background:'#f4f4e9', flexShrink:0 }}><img src={BRAND_PRINT_LOGO} alt="ERROR 404" style={{ display:'block', width:40, height:40, objectFit:'contain' }}/></div>
        <strong style={{ color:'#d5dfb2', fontSize:14, letterSpacing:2 }}>{couponBrand()}</strong>
      </div>
      <div style={{ fontSize:14, marginTop:12, overflowWrap:'anywhere' }}>{greeting}</div>
      <div style={{ fontSize:print ? 52 : 44, lineHeight:1.15, fontWeight:800, margin:'14px 0 18px' }}>{coupon.percentage}% OFF</div>
      <div style={{ border:'1px dashed #a6b67c', borderRadius:10, padding:'12px 14px', textAlign:'center', fontFamily:'monospace', fontSize:coupon.code.length > 20 ? 18 : 26, fontWeight:700, letterSpacing:2, background:'#ffffff0c', overflowWrap:'anywhere' }}>{coupon.code}</div>
      <div style={{ marginTop:16, fontSize:12, lineHeight:1.8, color:'#e1e6d7' }}>{terms.map(t => <div key={t}>• {t}</div>)}</div>
    </div>
    <div style={{ position:'relative', flex:print ? '0 0 28%' : undefined, background:OLIVE, borderLeft:print ? '2px dashed #cad4aa' : undefined, padding:print ? '30px 20px' : '18px 26px', display:'flex', flexDirection:'column', justifyContent:'space-between', gap:18, textAlign:print ? 'center' : 'left' }}>
      {print && <><span style={{ position:'absolute', top:-13, left:-14, width:26, height:26, borderRadius:'50%', background:'#fff' }}/><span style={{ position:'absolute', bottom:-13, left:-14, width:26, height:26, borderRadius:'50%', background:'#fff' }}/><strong style={{ fontSize:12, letterSpacing:1 }}>COUPON CODE</strong><strong style={{ fontSize:64 }}>%</strong></>}
      <div style={{ fontSize:12, lineHeight:1.6 }}>Show this code at billing to claim your offer.</div>
      {print && <small style={{ fontSize:10 }}>Applies to the product subtotal</small>}
    </div>
  </div>
}
