import { Fragment, type ReactNode } from 'react'

/**
 * Tiny Markdown renderer for answers: paragraphs, "- " lists, **bold**, *italic*, `code`
 * and citation markers like [G] or [D2], which become small chips.
 */
export function Markdown({ text, onCite }: { text: string; onCite?: (key: string) => void }) {
  const blocks = text.trim().split(/\n{2,}/)
  return (
    <div className="space-y-3 leading-relaxed">
      {blocks.map((block, i) => {
        const lines = block.split('\n')
        if (lines.every((l) => /^\s*([-*]|\d+\.)\s/.test(l))) {
          const ordered = /^\s*\d+\./.test(lines[0])
          const Tag = ordered ? 'ol' : 'ul'
          return (
            <Tag key={i} className={`space-y-1.5 ps-5 ${ordered ? 'list-decimal' : 'list-disc'} marker:text-muted`}>
              {lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*([-*]|\d+\.)\s/, ''), onCite)}</li>)}
            </Tag>
          )
        }
        return <p key={i}>{lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l, onCite)}</Fragment>)}</p>
      })}
    </div>
  )
}

function inline(s: string, onCite?: (k: string) => void): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[(?:G|D\d+)\])/g
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index))
    const t = m[0]
    if (t.startsWith('**')) out.push(<strong key={k++} className="font-semibold">{t.slice(2, -2)}</strong>)
    else if (t.startsWith('`')) out.push(<code key={k++} className="code px-1 py-0.5">{t.slice(1, -1)}</code>)
    else if (t.startsWith('[')) {
      const key = t.slice(1, -1)
      const label = key === 'G' ? 'Graph' : key
      out.push(
        onCite ? (
          <button key={k++} type="button" onClick={() => onCite(key)}
            className="mx-0.5 inline-flex min-h-[24px] items-center rounded-sm bg-accent-soft px-1.5 align-baseline text-xs font-medium text-ink"
            aria-label={key === 'G' ? 'Show graph query results' : `Show source ${key}`}>{label}</button>
        ) : (
          <span key={k++} className="mx-0.5 rounded-sm bg-accent-soft px-1.5 text-xs font-medium">{label}</span>
        ),
      )
    } else out.push(<em key={k++}>{t.slice(1, -1)}</em>)
    last = m.index + t.length
  }
  if (last < s.length) out.push(s.slice(last))
  return out
}
