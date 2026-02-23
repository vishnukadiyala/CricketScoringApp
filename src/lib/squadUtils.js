/**
 * Squad data model utilities.
 * Supports migration from legacy string[] to { id, name, status }[] format.
 */

let _counter = 0

/**
 * Generate a unique player ID.
 */
export function generatePlayerId() {
  return `p_${Date.now()}_${++_counter}`
}

/**
 * Idempotent migration: converts a squad from string[] to object[] format.
 * Already-migrated squads are returned as-is.
 */
export function migrateSquad(squad) {
  if (!Array.isArray(squad)) return []
  return squad.map(entry => {
    if (typeof entry === 'string') {
      return { id: generatePlayerId(), name: entry, status: 'active' }
    }
    // Already an object — ensure it has required fields
    return {
      id: entry.id || generatePlayerId(),
      name: entry.name || '',
      status: entry.status || 'active',
    }
  })
}

/**
 * Get names of active players only.
 */
export function getActivePlayerNames(squad) {
  if (!Array.isArray(squad)) return []
  return squad
    .filter(p => {
      if (typeof p === 'string') return true
      return p.status === 'active'
    })
    .map(p => (typeof p === 'string' ? p : p.name))
}

/**
 * Count active players in squad.
 */
export function countActivePlayers(squad) {
  if (!Array.isArray(squad)) return 0
  return squad.filter(p => {
    if (typeof p === 'string') return true
    return p.status === 'active'
  }).length
}
