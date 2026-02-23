import { createContext, useContext, useReducer, useEffect, useCallback } from 'react'
import { loadTournament, saveTournament } from '../lib/storage'
import { DEFAULT_OVERS_PER_INNINGS } from '../lib/constants'
import { useFirebaseSync } from '../lib/useFirebaseSync'
import { migrateSquad, generatePlayerId } from '../lib/squadUtils'

const TournamentContext = createContext()

export const initialTournamentState = {
  name: 'NCC Edition 5',
  oversPerInnings: DEFAULT_OVERS_PER_INNINGS,
  teams: [],
  matches: [],
  activeMatchId: null,
  phase: 'setup', // 'setup' | 'league' | 'eliminator' | 'final' | 'completed'
  spiritNotes: {}, // { matchId: string }
  squadChanges: [], // audit log of squad modifications
}

function generateLeagueSchedule(teams) {
  if (teams.length < 3) return []
  const m = (id, num, t1, t2) => ({
    id, matchNumber: num, type: 'league',
    team1Id: t1, team2Id: t2,
    status: 'upcoming', winnerId: null, isTied: false, result: '', teamSummaries: {},
  })
  // Each pair plays twice (6 league matches)
  return [
    m('match_1', 1, teams[0].id, teams[1].id),
    m('match_2', 2, teams[0].id, teams[2].id),
    m('match_3', 3, teams[1].id, teams[2].id),
    m('match_4', 4, teams[1].id, teams[0].id),
    m('match_5', 5, teams[2].id, teams[0].id),
    m('match_6', 6, teams[2].id, teams[1].id),
  ]
}

export function tournamentReducer(state, action) {
  switch (action.type) {
    case 'CREATE_TOURNAMENT': {
      return {
        ...state,
        name: action.name || state.name,
        oversPerInnings: action.oversPerInnings || state.oversPerInnings,
        phase: 'setup',
      }
    }

    case 'ADD_TEAM': {
      if (state.teams.length >= 3) return state
      const newId = `team_${state.teams.length + 1}`
      const newTeams = [...state.teams, { id: newId, name: action.name, squad: migrateSquad(action.squad || []) }]

      // Auto-generate league schedule when 3rd team is added
      if (newTeams.length === 3) {
        return {
          ...state,
          teams: newTeams,
          matches: generateLeagueSchedule(newTeams),
          phase: 'league',
        }
      }

      return { ...state, teams: newTeams }
    }

    case 'EDIT_TEAM': {
      const newTeams = state.teams.map(t =>
        t.id === action.teamId
          ? { ...t, name: action.name !== undefined ? action.name : t.name, squad: action.squad !== undefined ? migrateSquad(action.squad) : t.squad }
          : t
      )
      // If teams already = 3, regenerate schedule names (update team refs)
      let newMatches = state.matches
      if (newTeams.length === 3 && state.matches.length === 0) {
        newMatches = generateLeagueSchedule(newTeams)
      }
      return { ...state, teams: newTeams, matches: newMatches }
    }

    case 'REMOVE_TEAM': {
      const newTeams = state.teams.filter(t => t.id !== action.teamId)
      // Reset matches if we drop below 3 teams
      return {
        ...state,
        teams: newTeams,
        matches: newTeams.length < 3 ? [] : state.matches,
        phase: newTeams.length < 3 ? 'setup' : state.phase,
      }
    }

    case 'START_MATCH': {
      const newMatches = state.matches.map(m =>
        m.id === action.matchId ? { ...m, status: 'live' } : m
      )
      return { ...state, matches: newMatches, activeMatchId: action.matchId }
    }

    case 'COMPLETE_MATCH': {
      const { matchId, winnerId, isTied, result, teamSummaries } = action
      let newMatches = state.matches.map(m =>
        m.id === matchId
          ? { ...m, status: 'completed', winnerId, isTied, result, teamSummaries: teamSummaries || m.teamSummaries }
          : m
      )

      let newPhase = state.phase

      // Check if all league matches are done
      const leagueMatches = newMatches.filter(m => m.type === 'league')
      const allLeagueDone = leagueMatches.every(m => m.status === 'completed')

      const nextMatchNum = newMatches.length + 1

      if (allLeagueDone && !newMatches.find(m => m.type === 'eliminator')) {
        // Compute standings to determine 2nd and 3rd
        const standings = getQuickStandings(state.teams, leagueMatches)
        if (standings.length >= 3) {
          newMatches = [...newMatches, {
            id: `match_${nextMatchNum}`, matchNumber: nextMatchNum, type: 'eliminator',
            team1Id: standings[1].teamId, team2Id: standings[2].teamId,
            status: 'upcoming', winnerId: null, isTied: false, result: '', teamSummaries: {},
          }]
          newPhase = 'eliminator'
        }
      }

      // Check if eliminator is done
      const eliminator = newMatches.find(m => m.type === 'eliminator')
      if (eliminator && eliminator.status === 'completed' && !newMatches.find(m => m.type === 'final')) {
        const leagueStandings = getQuickStandings(state.teams, leagueMatches)
        const firstPlaceId = leagueStandings[0]?.teamId
        const eliminatorWinnerId = eliminator.winnerId
        const finalNum = newMatches.length + 1
        if (firstPlaceId && eliminatorWinnerId) {
          newMatches = [...newMatches, {
            id: `match_${finalNum}`, matchNumber: finalNum, type: 'final',
            team1Id: firstPlaceId, team2Id: eliminatorWinnerId,
            status: 'upcoming', winnerId: null, isTied: false, result: '', teamSummaries: {},
          }]
          newPhase = 'final'
        }
      }

      // Check if final is done
      const final_ = newMatches.find(m => m.type === 'final')
      if (final_ && final_.status === 'completed') {
        newPhase = 'completed'
      }

      return {
        ...state,
        matches: newMatches,
        activeMatchId: null,
        phase: newPhase,
      }
    }

    case 'ADD_PLAYER': {
      const { teamId, playerName, reason, changedBy } = action
      const newPlayer = { id: generatePlayerId(), name: playerName, status: 'active' }
      const newTeams = state.teams.map(t =>
        t.id === teamId ? { ...t, squad: [...t.squad, newPlayer] } : t
      )
      const logEntry = {
        id: `sc_${Date.now()}`,
        teamId,
        action: 'add',
        playerIn: playerName,
        playerOut: null,
        reason: reason || '',
        changedBy: changedBy || '',
        timestamp: Date.now(),
      }
      return { ...state, teams: newTeams, squadChanges: [...state.squadChanges, logEntry] }
    }

    case 'REMOVE_PLAYER': {
      const { teamId, playerId, reason, changedBy } = action
      let removedName = ''
      const newTeams = state.teams.map(t => {
        if (t.id !== teamId) return t
        return {
          ...t,
          squad: t.squad.map(p => {
            if (p.id === playerId) {
              removedName = p.name
              return { ...p, status: 'inactive' }
            }
            return p
          }),
        }
      })
      const logEntry = {
        id: `sc_${Date.now()}`,
        teamId,
        action: 'remove',
        playerIn: null,
        playerOut: removedName,
        reason: reason || '',
        changedBy: changedBy || '',
        timestamp: Date.now(),
      }
      return { ...state, teams: newTeams, squadChanges: [...state.squadChanges, logEntry] }
    }

    case 'REPLACE_PLAYER': {
      const { teamId, playerId, newPlayerName, reason, changedBy } = action
      let replacedName = ''
      const replacement = { id: generatePlayerId(), name: newPlayerName, status: 'active' }
      const newTeams = state.teams.map(t => {
        if (t.id !== teamId) return t
        const updatedSquad = t.squad.map(p => {
          if (p.id === playerId) {
            replacedName = p.name
            return { ...p, status: 'inactive' }
          }
          return p
        })
        return { ...t, squad: [...updatedSquad, replacement] }
      })
      const logEntry = {
        id: `sc_${Date.now()}`,
        teamId,
        action: 'replace',
        playerIn: newPlayerName,
        playerOut: replacedName,
        reason: reason || '',
        changedBy: changedBy || '',
        timestamp: Date.now(),
      }
      return { ...state, teams: newTeams, squadChanges: [...state.squadChanges, logEntry] }
    }

    case 'EDIT_PLAYER': {
      const { teamId, playerId, newName, reason, changedBy } = action
      let oldName = ''
      const newTeams = state.teams.map(t => {
        if (t.id !== teamId) return t
        return {
          ...t,
          squad: t.squad.map(p => {
            if (p.id === playerId) {
              oldName = p.name
              return { ...p, name: newName }
            }
            return p
          }),
        }
      })
      const logEntry = {
        id: `sc_${Date.now()}`,
        teamId,
        action: 'edit',
        playerIn: newName,
        playerOut: oldName,
        reason: reason || '',
        changedBy: changedBy || '',
        timestamp: Date.now(),
      }
      return { ...state, teams: newTeams, squadChanges: [...state.squadChanges, logEntry] }
    }

    case 'SET_SPIRIT_NOTE': {
      return {
        ...state,
        spiritNotes: {
          ...state.spiritNotes,
          [action.matchId]: action.note,
        },
      }
    }

    case 'RESET_TOURNAMENT': {
      return { ...initialTournamentState }
    }

    case 'SYNC_FROM_REMOTE': {
      const remote = action.payload
      if (!remote || !remote.teams || !remote.matches) return state
      // eslint-disable-next-line no-unused-vars
      const { _lastWriteTime, ...cleaned } = remote
      // Migrate remote squads and preserve squadChanges
      const migratedTeams = (cleaned.teams || []).map(t => ({
        ...t,
        squad: migrateSquad(t.squad),
      }))
      return {
        ...initialTournamentState,
        ...cleaned,
        teams: migratedTeams,
        squadChanges: cleaned.squadChanges || state.squadChanges || [],
      }
    }

    default:
      return state
  }
}

// Quick standings computation for reducer use (avoids circular import)
function getQuickStandings(teams, leagueMatches) {
  const completed = leagueMatches.filter(m => m.status === 'completed')
  const stats = teams.map(team => {
    let won = 0, lost = 0, tied = 0
    completed.forEach(m => {
      if (m.team1Id !== team.id && m.team2Id !== team.id) return
      if (m.isTied) tied++
      else if (m.winnerId === team.id) won++
      else lost++
    })
    const points = won * 2 + tied * 1

    // Simple NRR
    let runsScored = 0, oversFaced = 0, runsConceded = 0, oversBowled = 0
    completed.forEach(m => {
      if (m.team1Id !== team.id && m.team2Id !== team.id) return
      const s = m.teamSummaries?.[team.id]
      if (s) {
        runsScored += s.runsScored
        oversFaced += s.oversFaced
        runsConceded += s.runsConceded
        oversBowled += s.oversBowled
      }
    })
    const nrr = oversFaced > 0 && oversBowled > 0
      ? (runsScored / oversFaced) - (runsConceded / oversBowled)
      : 0

    return { teamId: team.id, teamName: team.name, points, nrr, won, lost, tied }
  })

  stats.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    return b.nrr - a.nrr
  })

  return stats
}

export function TournamentProvider({ children }) {
  const [state, dispatch] = useReducer(tournamentReducer, initialTournamentState, () => {
    const saved = loadTournament()
    if (!saved) return initialTournamentState
    // Migrate legacy string[] squads on load
    return {
      ...initialTournamentState,
      ...saved,
      teams: (saved.teams || []).map(t => ({ ...t, squad: migrateSquad(t.squad) })),
      squadChanges: saved.squadChanges || [],
    }
  })

  useEffect(() => {
    saveTournament(state)
  }, [state])

  const onRemoteUpdate = useCallback((data) => {
    dispatch({ type: 'SYNC_FROM_REMOTE', payload: data })
  }, [])

  const filterBeforeWrite = useCallback((s) => {
    // eslint-disable-next-line no-unused-vars
    const { _lastWriteTime, ...rest } = s
    return rest
  }, [])

  useFirebaseSync('/tournament', state, onRemoteUpdate, {
    debounceMs: 800,
    filterBeforeWrite,
  })

  const getTeamName = (teamId) => {
    const team = state.teams.find(t => t.id === teamId)
    return team ? team.name : teamId
  }

  const getTeamById = (teamId) => state.teams.find(t => t.id === teamId) || null

  const value = {
    ...state,
    dispatch,
    getTeamName,
    getTeamById,
  }

  return <TournamentContext.Provider value={value}>{children}</TournamentContext.Provider>
}

export function useTournament() {
  const context = useContext(TournamentContext)
  if (!context) throw new Error('useTournament must be used within TournamentProvider')
  return context
}
