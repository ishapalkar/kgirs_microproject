import type { Category } from './types'

const nf = new Intl.NumberFormat('en-IN')
export const num = (n: number, digits = 0) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n)
export const int = (n: number) => nf.format(Math.round(n))

/** 2308984 → "2.3 million", 807720 → "8.1 lakh" style is confusing for examiners; use millions/thousands. */
export function compact(n: number) {
  if (n >= 1e6) return `${num(n / 1e6, 1)} million`
  if (n >= 1e3) return `${num(n / 1e3, 0)} thousand`
  return int(n)
}

export const score = (n: number) => n.toFixed(2)

export const CATEGORIES: Category[] = ['Critical', 'High', 'Moderate', 'Low']

export const riskVar: Record<Category, string> = {
  Critical: '--risk-critical', High: '--risk-high', Moderate: '--risk-moderate', Low: '--risk-low',
}

/** Resolved colour for canvas/SVG/Leaflet, which can't read Tailwind classes. */
export function cssColor(varName: string, alpha = 1) {
  // Comma syntax: vis-network can't parse the modern "rgb(r g b)" form.
  const [r, g, b] = getComputedStyle(document.documentElement).getPropertyValue(varName).trim().split(/\s+/)
  return alpha === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`
}
export const riskColor = (c: Category, alpha = 1) => cssColor(riskVar[c], alpha)

export function categoryOf(score: number): Category {
  if (score >= 0.7) return 'Critical'
  if (score >= 0.55) return 'High'
  if (score >= 0.4) return 'Moderate'
  return 'Low'
}

export const FACILITY_LABEL: Record<string, string> = {
  Hospital: 'Hospitals', Park: 'Parks', WaterPoint: 'Drinking water', CoolingCentre: 'Cooling shelters',
}
