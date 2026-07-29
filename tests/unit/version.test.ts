import { describe, it, expect } from 'vitest'
import { comparerVersions } from '../../server/version'

describe('comparerVersions', () => {
  it('ordonne correctement', () => {
    expect(comparerVersions('1.0.0', '1.0.0')).toBe(0)
    expect(comparerVersions('1.0.1', '1.0.0')).toBeGreaterThan(0)
    expect(comparerVersions('1.0.0', '1.1.0')).toBeLessThan(0)
    expect(comparerVersions('2.0.0', '1.9.9')).toBeGreaterThan(0)
    expect(comparerVersions('1.10.0', '1.9.0')).toBeGreaterThan(0) // pas de tri lexical
  })
})
