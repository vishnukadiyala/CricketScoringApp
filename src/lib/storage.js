const TOURNAMENT_KEY = 'ncc_tournament'
const MATCH_PREFIX = 'ncc_match_'
const LEGACY_KEY = 'ncc_match_state'

export function loadTournament() {
  try {
    const saved = localStorage.getItem(TOURNAMENT_KEY)
    if (!saved) return null
    return JSON.parse(saved)
  } catch {
    return null
  }
}

export function saveTournament(state) {
  try {
    localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(state))
  } catch {
    // Storage full or unavailable
  }
}

export function clearTournament() {
  localStorage.removeItem(TOURNAMENT_KEY)
  // Also clear all match data
  const keysToRemove = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(MATCH_PREFIX)) {
      keysToRemove.push(key)
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k))
  localStorage.removeItem(LEGACY_KEY)
}

export function loadMatch(matchId) {
  try {
    const saved = localStorage.getItem(MATCH_PREFIX + matchId)
    if (!saved) return null
    return JSON.parse(saved)
  } catch {
    return null
  }
}

export function saveMatch(matchId, state) {
  try {
    localStorage.setItem(MATCH_PREFIX + matchId, JSON.stringify(state))
  } catch {
    // Storage full or unavailable
  }
}

export function clearMatch(matchId) {
  localStorage.removeItem(MATCH_PREFIX + matchId)
}

export function hasLegacyMatch() {
  try {
    const saved = localStorage.getItem(LEGACY_KEY)
    if (!saved) return false
    const parsed = JSON.parse(saved)
    return parsed && parsed.phase && parsed.phase !== 'setup'
  } catch {
    return false
  }
}
