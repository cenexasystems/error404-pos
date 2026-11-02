import { db } from '../lib/db'
import { normalizePhone } from '../lib/phone'
import { birthdayService } from './birthdayService'

export type ReturningCustomer = { name: string; birthDate: string }

const reliableName = (value: unknown) => {
  const name = String(value || '').trim()
  return /^(walk[- ]?in(?: customer)?|customer)$/i.test(name) ? '' : name
}

/** Bounded, phone-filtered reads only. DOB comes exclusively from birthday records. */
export async function findReturningCustomer(phone: string): Promise<ReturningCustomer | null> {
  const normalized = normalizePhone(phone)
  if (!normalized) return null
  const pattern = `%${normalized.slice(-10).split('').join('%')}%`
  const [birthdays, orders, advances] = await Promise.all([
    birthdayService.findByPhone(normalized),
    db.from('orders').select('customer_name, phone, created_at')
      .ilike('phone', pattern).order('created_at', { ascending: false }).limit(50),
    db.from('advance_orders').select('customer_name, phone, created_at')
      .ilike('phone', pattern).order('created_at', { ascending: false }).limit(50),
  ])
  const history = [...(orders.data || []), ...(advances.data || [])]
    .filter(row => normalizePhone(String(row.phone || '')) === normalized)
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
  const name = birthdays.map(row => reliableName(row.name)).find(Boolean)
    || history.map(row => reliableName(row.customer_name)).find(Boolean) || ''
  const birthDate = birthdays.map(row => String(row.birth_date || '').slice(0, 10))
    .find(value => /^\d{4}-\d{2}-\d{2}$/.test(value)) || ''
  return name || birthDate ? { name, birthDate } : null
}
