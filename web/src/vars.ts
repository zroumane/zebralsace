export interface StyleRange {
  start: number
  end: number
  style: Record<string, unknown>
}

export function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function computeVars(
  globales: { cle: string; valeur: string }[],
  fabrication: Date,
  peremption: Date
): Record<string, string> {
  return {
    ...Object.fromEntries(globales.map((g) => [g.cle, g.valeur])),
    date: formatDate(fabrication),
    dlc: formatDate(peremption),
  }
}

const VAR_RE = /\{\{\s*([a-zà-öø-ÿ_][\w-]*)\s*(?:\+\s*(\d+))?\s*\}\}/gi

function resoudre(nom: string, plus: string | undefined, vars: Record<string, string>, baseDate: Date): string | null {
  if (plus) return nom === 'date' ? formatDate(addDays(baseDate, Number(plus))) : null
  return vars[nom] ?? null
}

export function substituteWithStyles(
  text: string,
  styles: StyleRange[],
  vars: Record<string, string>,
  baseDate: Date
): { text: string; styles: StyleRange[] } {
  let out = text
  let ranges = styles.map((r) => ({ ...r }))
  VAR_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = VAR_RE.exec(out))) {
    const val = resoudre(m[1].toLowerCase(), m[2], vars, baseDate)
    if (val == null) continue // inconnue : on laisse le littéral visible
    const debut = m.index
    const ancienneLg = m[0].length
    const delta = val.length - ancienneLg
    out = out.slice(0, debut) + val + out.slice(debut + ancienneLg)
    ranges = ranges.map((r) => ({
      ...r,
      start: r.start >= debut + ancienneLg ? r.start + delta : r.start,
      end: r.end > debut ? r.end + delta : r.end,
    }))
    VAR_RE.lastIndex = debut + val.length
  }
  return { text: out, styles: ranges }
}

const DLC_RE = /\{\{\s*dlc\s*(?:\+\s*\d+)?\s*\}\}/i
const DATE_RE = /\{\{\s*date\s*(?:\+\s*\d+)?\s*\}\}/i

export function hydrateDoc(
  doc: any,
  vars: Record<string, string>,
  baseDate: Date,
  hideDlc: boolean,
  hideDate = false
): any {
  const clone = structuredClone(doc)
  clone.objects = (clone.objects ?? []).filter(
    (o: any) =>
      !(hideDlc && typeof o.text === 'string' && DLC_RE.test(o.text)) &&
      !(hideDate && typeof o.text === 'string' && DATE_RE.test(o.text))
  )
  for (const o of clone.objects) {
    if (typeof o.text === 'string') {
      const r = substituteWithStyles(o.text, o.styles ?? [], vars, baseDate)
      o.text = r.text
      o.styles = r.styles
    }
  }
  return clone
}
