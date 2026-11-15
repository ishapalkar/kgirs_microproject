import { AlertTriangle, RotateCw } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Category } from '../lib/types'

const riskClass: Record<Category, string> = {
  Critical: 'bg-risk-critical', High: 'bg-risk-high', Moderate: 'bg-risk-moderate', Low: 'bg-risk-low',
}

/** Category always shown as a coloured dot *and* its name, never colour alone. */
export function RiskBadge({ category, size = 'md' }: { category: Category; size?: 'sm' | 'md' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-ink ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
      <span aria-hidden className={`inline-block rounded-full ${riskClass[category]} ${size === 'sm' ? 'size-2' : 'size-2.5'}`} />
      {category}
    </span>
  )
}

export function riskBg(c: Category) {
  return riskClass[c]
}

export function PageHeader({ title, lead, actions }: { title: string; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-[68ch]">
        <h1 className="text-xl md:text-2xl">{title}</h1>
        {lead && <p className="mt-2 text-muted">{lead}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </header>
  )
}

export function Loading({ label = 'Loading…', className = '' }: { label?: string; className?: string }) {
  return (
    <div role="status" className={`flex items-center gap-3 p-6 text-sm text-muted ${className}`}>
      <span aria-hidden className="size-4 rounded-full border-2 border-line border-t-accent motion-safe:animate-spin" />
      {label}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="card flex flex-wrap items-start gap-3 p-5">
      <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0 text-danger" strokeWidth={2} />
      <div className="min-w-0 flex-1">
        <p className="font-medium">Unable to load this section</p>
        <p className="mt-1 text-sm text-muted">{message}</p>
      </div>
      {onRetry && (
        <button type="button" className="btn-secondary" onClick={onRetry}>
          <RotateCw aria-hidden className="size-4" /> Try again
        </button>
      )}
    </div>
  )
}

/** Horizontal 0–1 bar with its value, used for E / S / A components. */
export function ScoreBar({ label, value, tone = 'ink', note }: { label: string; value: number; tone?: 'ink' | 'accent'; note?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-muted">{label}</span>
        <span className="font-medium">{value.toFixed(2)}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-sunken" role="presentation">
        <div className={`h-full rounded-full ${tone === 'accent' ? 'bg-accent' : 'bg-ink/70'}`} style={{ width: `${Math.max(2, value * 100)}%` }} />
      </div>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </div>
  )
}

const STATUS_STYLE: Record<string, string> = {
  real: 'bg-risk-low/15 text-ink',
  derived: 'bg-accent-soft text-ink',
  estimate: 'bg-risk-moderate/20 text-ink',
  illustrative: 'bg-risk-high/15 text-ink',
  summary: 'bg-sunken text-ink',
}
const STATUS_LABEL: Record<string, string> = {
  real: 'Real data', derived: 'Calculated', estimate: 'Estimate', illustrative: 'Illustrative', summary: 'Summary',
}

/** Honest label for where a number comes from. */
export function DataTag({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status] ?? 'bg-sunken'}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

export function Fact({ value, label, sub }: { value: ReactNode; label: string; sub?: ReactNode }) {
  return (
    <div>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </div>
  )
}
