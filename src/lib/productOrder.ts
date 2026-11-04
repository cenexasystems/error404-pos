/** Creation order is independent of stock, price, variants and updated_at. */
export function newestProductsFirst(a: { id: number | string; createdAt?: string }, b: { id: number | string; createdAt?: string }) {
  return (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0) || String(b.id).localeCompare(String(a.id), undefined, { numeric: true })
}
