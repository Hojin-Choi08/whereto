import { describe, expect, it } from 'vitest'
import { lintSchemas } from 'deepspace/worker'
import { schemas } from './schemas'

describe('schemas', () => {
  it('pass the SDK schema lint with zero warnings', () => {
    expect(lintSchemas(schemas)).toEqual([])
  })

  it('register team_members whenever a collection uses read: team', () => {
    const usesTeam = schemas.some((s) =>
      Object.values(s.permissions).some((p) => p.read === 'team'),
    )
    expect(usesTeam).toBe(true)
    expect(schemas.map((s) => s.name)).toContain('team_members')
  })
})
