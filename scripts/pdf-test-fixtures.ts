/* eslint-disable @typescript-eslint/no-explicit-any */
import { invoicePdfFromProps, printSheetInvoice, thermalPreviewHtml } from '../src/lib/billPrint'
import { couponPdf } from '../src/lib/couponPdf'
import { createInvoicePdf } from '../src/lib/invoicePdf'
import { advanceReceiptPdf } from '../src/lib/advanceReceipt'
import { exportAnalyticsToPDF } from '../src/services/analyticsExport'
import { generateBarcodeSvgString } from '../src/lib/barcode'
import { BrowserMultiFormatReader } from '@zxing/browser'
export const sample = { invoiceNo:'00000034', date:'2026-11-04T08:00:00Z',customerName:'Test Customer',phone:'9876543210',address:'POS Counter',items:[{id:1,name:'Shirt - Small',qty:1,quantity:1,price:995,base_price:995,line_total:995}],subtotal:995,shipping:30,gstAmount:49.75,total:1074.75,paymentMode:'Split (Cash Rs.824.75 + QR Rs.250)',notes:'111222',paymentRows:[{label:'Deposit Paid',value:500},{label:'Cash',value:250,sub:true},{label:'QR',value:250,sub:true},{label:'Final Balance Paid (Cash)',value:574.75},{label:'Remaining Balance (Fully Settled)',value:0,accent:true}] }
export async function generate(kind:string) {
 let file:Blob
 if(kind==='coupon')file=await couponPdf({code:'DIWALI12',percentage:20,min_order_value:399,expiry_date:'2026-12-04'})
 else if(kind==='coupon-long')file=await couponPdf({code:'VERY-LONG-COUPON-CODE-2026-SPECIAL-SHOPPING-OFFER',percentage:15,min_order_value:0,expiry_date:null})
 else if(kind==='legacy')file=createInvoicePdf({...sample,items:sample.items})
 else if(kind==='legacy-long')file=createInvoicePdf({...sample,items:Array.from({length:70},(_,i)=>({...sample.items[0],name:`Test item ${i+1}`}))})
 else if(kind==='advance-legacy')file=advanceReceiptPdf({id:'fixture',deposit_id:'DEP-TEST',customer_name:'Test Customer',phone:'9876543210',address:'Test address',product_name:'Shirt',products:sample.items,total_amount:1074.75,deposit_amount:500,remaining_balance:574.75,created_at:sample.date,expected_delivery_date:'2026-11-10',status:'completed',final_payment_method:'cash',delivery_charge:30,subtotal:995,gst_amount:49.75,gst_enabled:true,gst_rate:5,discount_amount:0,remarks:'111222'} as any,[{payment_type:'deposit',amount:500,payment_method:'split',split_details:{cash:250,qr:250}},{payment_type:'remaining',amount:574.75,payment_method:'cash'}] as any)
 else file=await invoicePdfFromProps(kind==='long'?{...sample,items:Array.from({length:70},(_,i)=>({...sample.items[0],id:i+1,name:`Test item ${i+1} - a descriptive product name for wrapping checks`}))}:sample)
 return Array.from(new Uint8Array(await file.arrayBuffer()))
}
export function printable(){printSheetInvoice(sample,'A4');return document.querySelector('iframe')!.contentDocument!.documentElement.outerHTML}
export function thermal(){return thermalPreviewHtml(sample,{printer:'thermal',thermalWidth:80,sheetSize:'A4'} as any)}
export async function barcodeDecode(){
 const code='ULV10000001';const svg=generateBarcodeSvgString(code,{width:2,height:70,margin:12});const image=new Image();image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;canvas.getContext('2d')!.drawImage(image,0,0);return new BrowserMultiFormatReader().decodeFromCanvas(canvas).getText()
}
export async function report(tab:string){
 const data:any={totalCompletedRevenue:1074.75,netProfit:574.75,isProfitable:true,totalExpenses:0,completedOrders:1,posRevenue:1074.75,offlineOrderCount:1,onlinePosRevenue:0,onlineBillCount:0,manualRevenue:0,totalProductsSold:1,averageRevenuePerBill:1074.75,bestProduct:'Shirt',bestCategory:'Clothing',weeklySales:[{day:'Wed',date:'2026-11-04',revenue:1074.75}],todaySales:1074.75,todayCompletedOrdersCount:1,todayItemsSold:1,todayAvgOrderValue:1074.75,todayHourlyTrend:[{hour:'10 AM',key:'10',revenue:1074.75}],todayTopProducts:[{name:'Shirt',qty:1,revenue:995}],topProducts:[{name:'Shirt',qty:1,revenue:995,billCount:1}],topCategories:[{name:'Clothing',qty:1,revenue:995}],topCoupons:[{code:'TEST10',usage:1,discounts:100}],totalCouponDiscounts:100,totalCouponOrders:1,couponUsageRate:100}
 await exportAnalyticsToPDF({data,activeTab:tab,datePreset:'today'})
}
