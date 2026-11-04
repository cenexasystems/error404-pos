import { jsPDF } from 'jspdf'

export type PdfBlock = { top: number; bottom: number }

/** Capture row/paragraph boundaries before rasterization, so page cuts avoid text. */
export function pdfBlocks(root: HTMLElement): PdfBlock[] {
  const origin = root.getBoundingClientRect().top
  return Array.from(root.querySelectorAll<HTMLElement>('tr, p, h1, h2, h3, .invoice-footer, .invoice-summary')).map(el => {
    const r = el.getBoundingClientRect()
    return { top: r.top - origin, bottom: r.bottom - origin }
  })
}

/** A4 pages with natural proportions; never squash a long report into one page. */
export function canvasToPdf(canvas: HTMLCanvasElement, blocks: PdfBlock[] = [], cssWidth = canvas.width) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 5, width = 200, height = 287
  const scale = canvas.width / cssWidth
  const mmPerPixel = width / canvas.width
  const naturalHeight = canvas.height * mmPerPixel
  if (naturalHeight <= height * 1.08) {
    // A small overflow (e.g. a signature) can fit without an unnecessary page.
    const fit = Math.min(1, height / naturalHeight)
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin + width * (1-fit)/2, margin, width*fit, naturalHeight*fit, undefined, 'FAST')
    return pdf
  }
  const capacity = Math.floor(height / mmPerPixel)
  const protectedBlocks = blocks.map(b => ({ top: Math.round(b.top*scale), bottom: Math.round(b.bottom*scale) }))
  let start = 0, page = 0
  while (start < canvas.height) {
    let end = Math.min(canvas.height, start + capacity)
    // Move backwards until a boundary no longer intersects a row or paragraph.
    let changed = true
    while (changed) {
      changed = false
      for (const block of protectedBlocks) {
        if (block.top > start + 2 && block.top < end - 2 && block.bottom > end + 2 && block.bottom-block.top <= capacity) {
          end = block.top; changed = true
        }
      }
    }
    if (end <= start) end = Math.min(canvas.height, start + capacity)
    const slice = document.createElement('canvas')
    slice.width = canvas.width; slice.height = end-start
    slice.getContext('2d')!.drawImage(canvas, 0, start, canvas.width, slice.height, 0, 0, slice.width, slice.height)
    if (page++) pdf.addPage()
    pdf.addImage(slice.toDataURL('image/png'), 'PNG', margin, margin, width, slice.height*mmPerPixel, undefined, 'FAST')
    start = end
  }
  return pdf
}
