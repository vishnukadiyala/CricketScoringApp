import { useParams, useNavigate } from 'react-router-dom'
import { useTournament } from '../context/TournamentContext'
import { MatchProvider } from '../context/MatchContext'
import { extractTeamSummaries } from '../lib/standings'
import { useEffect, useRef } from 'react'
import ErrorBoundary from '../components/ErrorBoundary'
import MatchSetup from '../components/MatchSetup'
import BattingOrder from '../components/BattingOrder'
import ScoreDisplay from '../components/ScoreDisplay'
import Scoring from '../components/Scoring'
import OverSummary from '../components/OverSummary'
import InningsBreak from '../components/InningsBreak'
import SquadRotation from '../components/SquadRotation'
import SuperOver from '../components/SuperOver'
import MatchResult from '../components/MatchResult'

export default function MatchScoringPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { matches, teams, dispatch, getTeamName, getTeamById, oversPerInnings } = useTournament()

  const match = matches.find(m => m.id === id)

  if (!match) {
    return (
      <div className="app">
        <main className="app-main">
          <div className="card" style={{ textAlign: 'center' }}>
            <h2>Match not found</h2>
            <button className="btn btn-primary btn-block" onClick={() => navigate('/')}>
              Back to Dashboard
            </button>
          </div>
        </main>
      </div>
    )
  }

  const team1 = getTeamById(match.team1Id)
  const team2 = getTeamById(match.team2Id)

  const initialConfig = {
    team1: team1?.name || '',
    team2: team2?.name || '',
    oversPerInnings,
    squad1: team1?.squad || [],
    squad2: team2?.squad || [],
  }

  const handleComplete = (matchState) => {
    const summaries = extractTeamSummaries(matchState, match.team1Id, match.team2Id)

    // Determine winner
    const t1Total = matchState.cumulativeScores.team1
    const t2Total = matchState.cumulativeScores.team2
    let winnerId = null
    let isTied = false

    if (t1Total > t2Total) {
      winnerId = match.team1Id
    } else if (t2Total > t1Total) {
      winnerId = match.team2Id
    } else {
      // Check super over result
      if (matchState.superOver) {
        const so = matchState.superOver
        if (so.innings1.runs > so.innings2.runs) {
          winnerId = match.team1Id === teams.find(t => t.name === so.battingFirst)?.id ? match.team1Id : match.team2Id
        } else if (so.innings2.runs > so.innings1.runs) {
          winnerId = match.team1Id === teams.find(t => t.name === so.battingSecond)?.id ? match.team1Id : match.team2Id
        }
      }
      if (!winnerId) {
        // Check result string for boundary count or actual tie
        if (matchState.result.includes('boundary count')) {
          // Parse winner from result
          const resultName = matchState.result.split(' won')[0]
          winnerId = teams.find(t => t.name === resultName)?.id || null
        }
        if (!winnerId) isTied = true
      }
    }

    dispatch({
      type: 'COMPLETE_MATCH',
      matchId: id,
      winnerId,
      isTied,
      result: matchState.result,
      teamSummaries: summaries,
    })
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Cricket Scorer — NCC Ed. 5</h1>
      </header>
      <main className="app-main">
        <MatchProvider
          key={id}
          matchId={id}
          onMatchComplete={handleComplete}
          initialConfig={initialConfig}
        >
          <ErrorBoundary>
            <MatchSetup />
            <BattingOrder />
            <ScoreDisplay />
            <Scoring />
            <OverSummary />
            <InningsBreak />
            <SquadRotation />
            <SuperOver />
            <MatchResult isTournament />
          </ErrorBoundary>
        </MatchProvider>
      </main>
    </div>
  )
}
