import { BRAND_EN, BRAND_PRINT_LOGO } from '../../lib/brand'
import { formatCurrency } from '../../lib/retail'

export type CouponOffer = { code: string; percentage: number; min_order_value: number; expiry_date: string | null }

export function CouponVoucher({ coupon }: { coupon: CouponOffer }) {
  return <div data-coupon-voucher className="flex-col sm:flex-row" style={{ display:'flex', width:'100%', background:'#111827', color:'#fff', borderRadius:22, overflow:'hidden', fontFamily:'Arial, sans-serif' }}>
    <div style={{ flex:1, minWidth:0, padding:28 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
        <img src={BRAND_PRINT_LOGO} alt="" style={{ width:40, height:40, objectFit:'contain' }}/>
        <strong style={{ fontSize:16, letterSpacing:1 }}>{BRAND_EN}</strong>
      </div>
      <div style={{ fontSize:16 }}>A gift for you</div>
      <div style={{ fontSize:42, lineHeight:1.2, fontWeight:900, margin:'12px 0' }}>{coupon.percentage}% OFF</div>
      <div style={{ border:'1px dashed #9CA3AF', borderRadius:10, padding:12, textAlign:'center', fontFamily:'monospace', fontSize:26, fontWeight:700, overflowWrap:'anywhere', background:'#1f2937' }}>{coupon.code}</div>
      <div style={{ fontSize:13, lineHeight:1.7, marginTop:14 }}>
        <div>{coupon.min_order_value > 0 ? `Minimum purchase: ${formatCurrency(coupon.min_order_value)}` : 'No minimum purchase'}</div>
        {coupon.expiry_date && <div>Valid until {new Date(coupon.expiry_date).toLocaleDateString('en-IN')}</div>}
        <div>Subject to coupon validity and availability.</div>
      </div>
    </div>
    <div style={{ flex:'0 0 27%', padding:'28px 18px', background:'rgb(var(--primary))', color:'rgb(var(--primary-ink))', display:'flex', flexDirection:'column', justifyContent:'space-between', textAlign:'center', borderLeft:'2px dashed #ffffff80' }}>
      <strong style={{ fontSize:14 }}>COUPON CODE</strong>
      <strong style={{ fontSize:64 }}>%</strong>
      <div style={{ fontSize:13, lineHeight:1.5 }}>Show this code at billing to claim your offer.</div>
      <small style={{ fontSize:10 }}>Applies to the product subtotal</small>
    </div>
  </div>
}
