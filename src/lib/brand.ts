
import { LOGO_BASE64 } from './logoBase64'

/**
 * Shop branding and contact details.
 *
 * These are the default settings for ERROR 404.
 * Saved settings may override these defaults, so update the
 * Dashboard → Settings page after replacing this file if needed.
 */

export interface BrandSettings {
  name: string
  nameTa: string
  tagline: string
  ownerName: string
  ownerPhone: string
  shopPhone: string
  whatsapp: string
  email: string
  address: string
  instagram: string
  logo: string
  accentColor: string
  city: string
  businessHours: string
  catalogueHeadline: string
  gstin: string
}

export const DEFAULT_BRAND_SETTINGS: BrandSettings = {
  name: 'ERROR 404',
  nameTa: '',
  tagline: "Men's Outfits & Accessories",
  ownerName: '',
  ownerPhone: '9442647715',
  shopPhone: '8300280869',
  whatsapp: '8300280869',
  email: 'error404mensoutfit@gmail.com',
  address: '',
  instagram: '',
  logo: '',
  accentColor: '#171717',
  city: '',
  businessHours: '',
  catalogueHeadline: "Men's Outfits & Accessories",
  gstin: '',
}

/**
 * Use a new cache key for the ERROR 404 clone.
 * This prevents the old NAAYAN browser cache from being read.
 */
const CACHE_KEY = 'error404_brand_settings_v1'

/**
 * The image must exist inside the public folder:
 * public/error404-logo.png
 */
export const DEFAULT_LOGO = '/error404-logo.png'

/**
 * Update this after deploying your own project to Vercel.
 * Example: https://your-error404-shop.vercel.app
 */
export const BRAND_PRODUCTION_DOMAIN =
  'https://error404-pos.vercel.app/admin-login'

/** Convert an Indian phone number to digits with country code 91. */
export const toE164 = (input: string): string => {
  const digits = (input || '').replace(/\D/g, '')

  if (digits.length === 10) return `91${digits}`

  if (digits.length === 11 && digits.startsWith('0')) {
    return `91${digits.slice(1)}`
  }

  return digits
}

/** Format a phone number for display. */
export const toPhoneDisplay = (input: string): string => {
  const digits = toE164(input)

  if (!digits) return ''

  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`
  }

  return `+${digits}`
}

export let BRAND_SETTINGS: BrandSettings = {
  ...DEFAULT_BRAND_SETTINGS,
}

export let BRAND_EN = ''
export let BRAND_TA = ''
export let BRAND_SHORT = ''

export const BRAND_SUBTITLE: string = ''
export let BRAND_TAGLINE = ''
export const BRAND_ESTABLISHED: string = ''

export let BRAND_LOGO = DEFAULT_LOGO
export let BRAND_ICON = DEFAULT_LOGO
export let BRAND_FAVICON = DEFAULT_LOGO

/** Logo used by PDF, thermal and print templates. */
export let BRAND_PRINT_LOGO = LOGO_BASE64

export let BRAND_OWNER_NAME = ''
export let BRAND_OWNER_PHONE_DISPLAY = ''
export let BRAND_OWNER_PHONE_E164 = ''

export let BRAND_SHOP_PHONE_DISPLAY = ''
export let BRAND_SHOP_PHONE_E164 = ''

// Primary = shop phone, secondary = owner phone, third = WhatsApp.
export let BRAND_PRIMARY_PHONE_DISPLAY = ''
export let BRAND_PRIMARY_PHONE_E164 = ''

export let BRAND_SECONDARY_PHONE_DISPLAY = ''
export let BRAND_SECONDARY_PHONE_E164 = ''

export let BRAND_THIRD_PHONE_DISPLAY = ''
export let BRAND_THIRD_PHONE_E164 = ''

export let BRAND_PHONE_DISPLAY = ''
export let BRAND_PHONE_E164 = ''

export let BRAND_WHATSAPP = ''
export let WHATSAPP_NUM = ''
export let BRAND_WHATSAPP_LINK = ''

export let BRAND_EMAIL = ''
export let BRAND_ADDRESS = ''
export let BRAND_INSTAGRAM = ''
export let BRAND_INSTAGRAM_URL = ''
export let BRAND_LOCATION_LINK = '#'
export let BRAND_CITY = ''
export let BRAND_HOURS = ''
export let BRAND_CATALOGUE_HEADLINE = ''
export let BRAND_GSTIN = ''

export const BRAND_CATEGORIES = [
  'Mens Wear',
  'Womens Wear',
  'Kids Wear',
] as const

export const DEFAULT_ACCENT = '#171717'

const parseHex = (
  hex: string,
): [number, number, number] | null => {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())

  if (!match) return null

  const value = parseInt(match[1], 16)

  return [
    (value >> 16) & 255,
    (value >> 8) & 255,
    value & 255,
  ]
}

export const isValidAccent = (hex: string) =>
  parseHex(hex) !== null

/** Apply the accent colour to the application's CSS variables. */
export function applyAccentColor(hex: string): void {
  if (typeof document === 'undefined') return

  const rgb = parseHex(hex) || parseHex(DEFAULT_ACCENT)!

  const mix = (amount: number) =>
    rgb
      .map((channel) =>
        Math.round(channel + (255 - channel) * amount),
      )
      .join(' ')

  const [r, g, b] = rgb

  const luminance =
    (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255

  const variables: Record<string, string> = {
    '--primary': rgb.join(' '),
    '--primary-hover': mix(0.15),
    '--primary-muted': mix(0.3),
    '--primary-soft': mix(0.5),
    '--primary-200': mix(0.75),
    '--primary-100': mix(0.85),
    '--primary-50': mix(0.94),
    '--primary-ink':
      luminance > 0.62 ? '17 17 17' : '255 255 255',
  }

  const root = document.documentElement

  for (const [key, value] of Object.entries(variables)) {
    root.style.setProperty(key, value)
  }

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute(
      'content',
      `#${rgb
        .map((channel) =>
          channel.toString(16).padStart(2, '0'),
        )
        .join('')}`,
    )
}

/** Apply the supplied settings to the exported branding values. */
export function applyBrandSettings(
  input: Partial<BrandSettings>,
): void {
  const settings: BrandSettings = {
    ...DEFAULT_BRAND_SETTINGS,
  }

  for (const key of Object.keys(settings) as Array<
    keyof BrandSettings
  >) {
    const value = input[key]

    if (typeof value === 'string') {
      settings[key] = value.trim()
    }
  }

  settings.name =
    settings.name || DEFAULT_BRAND_SETTINGS.name

  settings.instagram = settings.instagram
    .replace(/^@/, '')
    .replace(
      /^https?:\/\/(www\.)?instagram\.com\//i,
      '',
    )
    .replace(/\/+$/, '')

  if (!isValidAccent(settings.accentColor)) {
    settings.accentColor = DEFAULT_ACCENT
  }

  BRAND_SETTINGS = settings

  applyAccentColor(settings.accentColor)

  BRAND_EN = settings.name
  BRAND_TA = settings.nameTa
  BRAND_SHORT = settings.name
  BRAND_TAGLINE = settings.tagline

  BRAND_LOGO = settings.logo || DEFAULT_LOGO
  BRAND_ICON = BRAND_LOGO
  BRAND_FAVICON = DEFAULT_LOGO

  BRAND_PRINT_LOGO = settings.logo || LOGO_BASE64

  const shop = toE164(settings.shopPhone)
  const owner = toE164(settings.ownerPhone)
  const whatsapp =
    toE164(settings.whatsapp) || shop || owner

  const primary = shop || owner || whatsapp
  const secondary = owner || primary

  BRAND_OWNER_NAME = settings.ownerName
  BRAND_OWNER_PHONE_E164 = owner
  BRAND_OWNER_PHONE_DISPLAY = toPhoneDisplay(owner)

  BRAND_SHOP_PHONE_E164 = shop
  BRAND_SHOP_PHONE_DISPLAY = toPhoneDisplay(shop)

  BRAND_PRIMARY_PHONE_E164 = primary
  BRAND_PRIMARY_PHONE_DISPLAY = toPhoneDisplay(primary)

  BRAND_SECONDARY_PHONE_E164 = secondary
  BRAND_SECONDARY_PHONE_DISPLAY =
    toPhoneDisplay(secondary)

  BRAND_THIRD_PHONE_E164 = whatsapp
  BRAND_THIRD_PHONE_DISPLAY =
    toPhoneDisplay(whatsapp)

  BRAND_PHONE_E164 = primary
  BRAND_PHONE_DISPLAY = toPhoneDisplay(primary)

  WHATSAPP_NUM = whatsapp
  BRAND_WHATSAPP = toPhoneDisplay(whatsapp)

  BRAND_WHATSAPP_LINK = whatsapp
    ? `https://wa.me/${whatsapp}`
    : ''

  BRAND_EMAIL = settings.email
  BRAND_ADDRESS = settings.address

  BRAND_INSTAGRAM = settings.instagram
  BRAND_INSTAGRAM_URL = settings.instagram
    ? `https://instagram.com/${settings.instagram}`
    : ''

  BRAND_CITY = settings.city
  BRAND_HOURS = settings.businessHours
  BRAND_CATALOGUE_HEADLINE =
    settings.catalogueHeadline

  BRAND_GSTIN = settings.gstin.toUpperCase()

  BRAND_LOCATION_LINK = settings.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        settings.address,
      )}`
    : '#'
}

/** Read settings cached by this cloned application. */
export function readCachedBrandSettings():
  | Partial<BrandSettings>
  | null {
  try {
    if (typeof localStorage === 'undefined') {
      return null
    }

    const raw = localStorage.getItem(CACHE_KEY)

    return raw
      ? (JSON.parse(raw) as Partial<BrandSettings>)
      : null
  } catch {
    return null
  }
}

/** Cache settings for this browser. */
export function cacheBrandSettings(
  settings: BrandSettings,
): void {
  try {
    if (typeof localStorage === 'undefined') return

    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify(settings),
    )
  } catch {
    // Storage may be full or unavailable.
  }
}

applyBrandSettings(readCachedBrandSettings() || {})