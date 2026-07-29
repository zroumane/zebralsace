import { describe, it, expect } from 'vitest'
import { formatDate, addDays, computeVars, substituteWithStyles, hydrateDoc } from '../../web/src/vars'

const BASE = new Date(2026, 1, 1) // 01/02/2026

describe('dates', () => {
  it('formate en JJ/MM/AAAA', () => {
    expect(formatDate(BASE)).toBe('01/02/2026')
  })
  it('addDays passe les fins de mois', () => {
    expect(formatDate(addDays(BASE, 30))).toBe('03/03/2026')
  })
  it('computeVars fusionne globales et dates', () => {
    const v = computeVars([{ cle: 'adresse', valeur: 'Lyon' }], BASE, addDays(BASE, 14))
    expect(v).toEqual({ adresse: 'Lyon', date: '01/02/2026', dlc: '15/02/2026' })
  })
})

describe('substituteWithStyles', () => {
  const VARS = { date: '01/02/2026', dlc: '15/02/2026', x: 'longue' }

  it('remplace les variables simples', () => {
    const r = substituteWithStyles('Fabriqué le {{date}}', [], VARS, BASE)
    expect(r.text).toBe('Fabriqué le 01/02/2026')
  })
  it('gère {{date+N}}', () => {
    const r = substituteWithStyles('{{date+3}}', [], VARS, BASE)
    expect(r.text).toBe('04/02/2026')
  })
  it('laisse les variables inconnues telles quelles', () => {
    expect(substituteWithStyles('{{oups}}', [], VARS, BASE).text).toBe('{{oups}}')
  })
  it('{{autre+N}} reste littéral (faute visible)', () => {
    expect(substituteWithStyles('{{adresse+2}}', [], { adresse: 'Lyon' }, BASE).text).toBe('{{adresse+2}}')
  })
  it('décale les styles situés après la variable', () => {
    // 'AB {{x}} CD' : CD en gras (9–11) ; {{x}} (5) → 'longue' (6) : delta +1
    const r = substituteWithStyles('AB {{x}} CD', [{ start: 9, end: 11, style: { fontWeight: 'bold' } }], VARS, BASE)
    expect(r.text).toBe('AB longue CD')
    expect(r.styles).toEqual([{ start: 10, end: 12, style: { fontWeight: 'bold' } }])
    expect(r.text.slice(10, 12)).toBe('CD')
  })
  it('gras + souligné posés sur une variable couvrent la valeur substituée', () => {
    const r = substituteWithStyles(
      'DLC {{dlc}}',
      [{ start: 4, end: 11, style: { underline: true, fontWeight: '700' } }],
      { dlc: '15/02/2026', date: '01/02/2026' },
      BASE
    )
    expect(r.text).toBe('DLC 15/02/2026')
    expect(r.styles[0]).toEqual({ start: 4, end: 14, style: { underline: true, fontWeight: '700' } })
  })

  it('étire un style qui englobe la variable', () => {
    const r = substituteWithStyles('{{x}}!', [{ start: 0, end: 6, style: { fontWeight: 'bold' } }], VARS, BASE)
    expect(r.styles[0]).toEqual({ start: 0, end: 7, style: { fontWeight: 'bold' } })
  })
})

describe('hydrateDoc', () => {
  const doc = {
    objects: [
      { type: 'Textbox', text: 'DLC {{dlc}}', styles: [] },
      { type: 'Textbox', text: 'Fabriqué le {{date}}', styles: [] },
      { type: 'Rect' },
    ],
  }
  it('substitue les textes', () => {
    const h = hydrateDoc(doc, { date: '01/02/2026', dlc: '15/02/2026' }, BASE, false)
    expect(h.objects[0].text).toBe('DLC 15/02/2026')
    expect(h.objects[1].text).toBe('Fabriqué le 01/02/2026')
  })
  it('hideDlc retire les blocs contenant {{dlc}}', () => {
    const h = hydrateDoc(doc, { date: '01/02/2026', dlc: '15/02/2026' }, BASE, true)
    expect(h.objects).toHaveLength(2)
    expect(h.objects[0].text).toBe('Fabriqué le 01/02/2026')
  })
  it('hideDlc tolère la casse et les espaces', () => {
    const doc2 = { objects: [{ type: 'Textbox', text: 'DLC {{ DLC }}', styles: [] }] }
    expect(hydrateDoc(doc2, { dlc: 'x', date: 'y' }, BASE, true).objects).toHaveLength(0)
  })
  it('hideDlc retire aussi {{dlc+3}}', () => {
    const doc3 = { objects: [{ type: 'Textbox', text: '{{dlc+3}}', styles: [] }] }
    expect(hydrateDoc(doc3, { dlc: 'x', date: 'y' }, BASE, true).objects).toHaveLength(0)
  })
  it('ne modifie pas le doc d\'origine', () => {
    hydrateDoc(doc, { dlc: 'x', date: 'y' }, BASE, false)
    expect(doc.objects[0].text).toBe('DLC {{dlc}}')
  })
})
