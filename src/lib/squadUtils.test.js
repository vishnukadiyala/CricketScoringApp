import { describe, it, expect } from 'vitest'
import { migrateSquad, getActivePlayerNames, countActivePlayers, generatePlayerId } from './squadUtils'

describe('generatePlayerId', () => {
  it('returns a unique string starting with p_', () => {
    const id1 = generatePlayerId()
    const id2 = generatePlayerId()
    expect(id1).toMatch(/^p_/)
    expect(id2).toMatch(/^p_/)
    expect(id1).not.toBe(id2)
  })
})

describe('migrateSquad', () => {
  it('converts string[] to object[]', () => {
    const result = migrateSquad(['Alice', 'Bob'])
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('Alice')
    expect(result[0].status).toBe('active')
    expect(result[0].id).toMatch(/^p_/)
    expect(result[1].name).toBe('Bob')
  })

  it('passes through already-migrated objects', () => {
    const squad = [{ id: 'p_1', name: 'Alice', status: 'active' }]
    const result = migrateSquad(squad)
    expect(result[0].id).toBe('p_1')
    expect(result[0].name).toBe('Alice')
    expect(result[0].status).toBe('active')
  })

  it('handles mixed string and object entries', () => {
    const squad = ['Alice', { id: 'p_2', name: 'Bob', status: 'inactive' }]
    const result = migrateSquad(squad)
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('Alice')
    expect(result[0].status).toBe('active')
    expect(result[1].name).toBe('Bob')
    expect(result[1].status).toBe('inactive')
  })

  it('returns empty array for non-array input', () => {
    expect(migrateSquad(null)).toEqual([])
    expect(migrateSquad(undefined)).toEqual([])
    expect(migrateSquad('hello')).toEqual([])
  })

  it('fills missing fields on partial objects', () => {
    const result = migrateSquad([{ name: 'Alice' }])
    expect(result[0].id).toMatch(/^p_/)
    expect(result[0].status).toBe('active')
  })
})

describe('getActivePlayerNames', () => {
  it('returns names of active players from object squad', () => {
    const squad = [
      { id: 'p_1', name: 'Alice', status: 'active' },
      { id: 'p_2', name: 'Bob', status: 'inactive' },
      { id: 'p_3', name: 'Charlie', status: 'active' },
    ]
    expect(getActivePlayerNames(squad)).toEqual(['Alice', 'Charlie'])
  })

  it('returns all names from legacy string[]', () => {
    expect(getActivePlayerNames(['Alice', 'Bob'])).toEqual(['Alice', 'Bob'])
  })

  it('handles empty/null input', () => {
    expect(getActivePlayerNames([])).toEqual([])
    expect(getActivePlayerNames(null)).toEqual([])
  })
})

describe('countActivePlayers', () => {
  it('counts active players in object squad', () => {
    const squad = [
      { id: 'p_1', name: 'Alice', status: 'active' },
      { id: 'p_2', name: 'Bob', status: 'inactive' },
      { id: 'p_3', name: 'Charlie', status: 'active' },
    ]
    expect(countActivePlayers(squad)).toBe(2)
  })

  it('counts all players in legacy string[]', () => {
    expect(countActivePlayers(['A', 'B', 'C'])).toBe(3)
  })

  it('returns 0 for empty/null input', () => {
    expect(countActivePlayers([])).toBe(0)
    expect(countActivePlayers(null)).toBe(0)
  })
})
