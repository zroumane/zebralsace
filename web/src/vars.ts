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
  peremption: Date,
  quantiteCarton: number
): Record<string, string> {
  return {
    // un input de valeur globale reste sur une ligne (impossible d'y taper un
    // vrai retour à la ligne) : "\n" littéral tapé par l'utilisateur devient
    // un vrai saut de ligne une fois substitué sur l'étiquette
    ...Object.fromEntries(globales.map((g) => [g.cle, g.valeur.replaceAll('\\n', '\n')])),
    date: formatDate(fabrication),
    dlc: formatDate(peremption),
    quantite: `x${quantiteCarton}`,
  }
}

const VAR_RE = /\{\{\s*([a-zà-öø-ÿ_][\w-]*)\s*(?:\+\s*(\d+))?\s*\}\}/gi

function resoudre(
  nom: string,
  plus: string | undefined,
  vars: Record<string, string>,
  baseDate: Date,
  masquees?: Set<string>
): string | null {
  if (masquees?.has(nom)) return '' // variable décochée à l'impression : effacée
  if (plus) return nom === 'date' ? formatDate(addDays(baseDate, Number(plus))) : null
  return vars[nom] ?? null
}

export function substituteWithStyles(
  text: string,
  styles: StyleRange[],
  vars: Record<string, string>,
  baseDate: Date,
  masquees?: Set<string>
): { text: string; styles: StyleRange[] } {
  let out = text
  let ranges = styles.map((r) => ({ ...r }))
  VAR_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = VAR_RE.exec(out))) {
    const val = resoudre(m[1].toLowerCase(), m[2], vars, baseDate, masquees)
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
  hideDate = false,
  hideQuantite = false
): any {
  const clone = structuredClone(doc)
  const masquees = new Set<string>([
    ...(hideDlc ? ['dlc'] : []),
    ...(hideDate ? ['date'] : []),
    ...(hideQuantite ? ['quantite'] : []),
  ])
  // Un bloc n'est supprimé en entier que si toutes les dates (date/dlc) qu'il
  // contient sont cachées. Bloc mixte dont l'une reste visible : conservé, la
  // variable cachée y est simplement effacée par la substitution.
  // {{quantite}} suit une règle différente : jamais de suppression de bloc,
  // seule sa valeur (le "x{{nombre}}") est effacée quand elle est masquée —
  // le reste du texte du bloc (libellé, autres variables) reste affiché.
  clone.objects = (clone.objects ?? []).filter((o: any) => {
    if (typeof o.text !== 'string') return true
    const presentes = [DLC_RE.test(o.text) && 'dlc', DATE_RE.test(o.text) && 'date'].filter(
      (v): v is string => v !== false
    )
    if (!presentes.length) return true
    return presentes.some((v) => !masquees.has(v))
  })
  for (const o of clone.objects) {
    if (typeof o.text === 'string') {
      const r = substituteWithStyles(o.text, o.styles ?? [], vars, baseDate, masquees)
      o.text = r.text
      o.styles = r.styles
    }
  }
  return clone
}
