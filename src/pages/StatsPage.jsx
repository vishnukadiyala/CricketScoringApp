import { useState, useMemo } from 'react'
import { useTournament } from '../context/TournamentContext'
import {
  loadCompletedMatchData,
  filterMatchData,
  computeBattingLeaderboard,
  getOrangeCapList,
  getMostFours,
  getMostSixes,
  getBestStrikeRate,
  getBestBattingAverage,
  getHighestScores,
  getMostThirtyPlus,
  getMostDucks,
  computeBowlingLeaderboard,
  getPurpleCapList,
  getBestEconomy,
  getBestBowlingFigures,
  getMostDotBalls,
  getMostMaidens,
  getMostExpensiveOvers,
  computeFieldingStats,
  computeTeamStats,
  getHighestTeamTotals,
  getLowestTeamTotals,
  getBiggestWins,
  getHighestMatchAggregates,
  getClosestMatches,
  getMostExtrasInInnings,
  getFollowOnStats,
  getSuperOverRecords,
  computeParticipation,
} from '../lib/stats'

const TABS = [
  { id: 'batting', label: 'Batting' },
  { id: 'bowling', label: 'Bowling' },
  { id: 'fielding', label: 'Fielding' },
  { id: 'teams', label: 'Teams' },
  { id: 'records', label: 'Records' },
  { id: 'participation', label: 'Players' },
]

export default function StatsPage() {
  const { teams, matches, name } = useTournament()
  const [activeTab, setActiveTab] = useState('batting')
  const [stage, setStage] = useState('all')
  const [teamFilter, setTeamFilter] = useState('all')
  const [playerModal, setPlayerModal] = useState(null)

  const allMatchData = useMemo(() => loadCompletedMatchData(matches), [matches])
  const filteredData = useMemo(() => filterMatchData(allMatchData, { stage, teamId: teamFilter }), [allMatchData, stage, teamFilter])

  const battingStats = useMemo(() => computeBattingLeaderboard(filteredData, teams), [filteredData, teams])
  const bowlingStats = useMemo(() => computeBowlingLeaderboard(filteredData), [filteredData])

  const completedCount = allMatchData.length
  if (completedCount === 0) {
    return (
      <div className="app">
        <header className="app-header">
          <h1>Tournament Stats</h1>
        </header>
        <main className="app-main">
          <div className="card" style={{ textAlign: 'center' }}>
            <p>No completed matches yet. Stats will appear after the first match.</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Tournament Stats</h1>
      </header>
      <main className="app-main">
        {/* Tab Navigation */}
        <div className="stats-tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`stats-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="stats-filters">
          <select
            className="form-select stats-filter-select"
            value={stage}
            onChange={e => setStage(e.target.value)}
          >
            <option value="all">All Stages</option>
            <option value="league">League</option>
            <option value="knockout">Knockout</option>
          </select>
          <select
            className="form-select stats-filter-select"
            value={teamFilter}
            onChange={e => setTeamFilter(e.target.value)}
          >
            <option value="all">All Teams</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {/* Tab Content */}
        {activeTab === 'batting' && (
          <BattingTab
            battingStats={battingStats}
            bowlingStats={bowlingStats}
            onPlayerClick={setPlayerModal}
          />
        )}
        {activeTab === 'bowling' && (
          <BowlingTab
            bowlingStats={bowlingStats}
            battingStats={battingStats}
            matchData={filteredData}
            onPlayerClick={setPlayerModal}
          />
        )}
        {activeTab === 'fielding' && (
          <FieldingTab matchData={filteredData} />
        )}
        {activeTab === 'teams' && (
          <TeamsTab matchData={filteredData} teams={teams} />
        )}
        {activeTab === 'records' && (
          <RecordsTab matchData={filteredData} teams={teams} />
        )}
        {activeTab === 'participation' && (
          <ParticipationTab matchData={filteredData} teams={teams} />
        )}

        {/* Player Profile Modal */}
        {playerModal && (
          <PlayerModal
            player={playerModal}
            battingStats={battingStats}
            bowlingStats={bowlingStats}
            onClose={() => setPlayerModal(null)}
          />
        )}
      </main>
    </div>
  )
}

// ─── Utility: rank class for top 3 ─────────────────────────────

function rankClass(index) {
  if (index === 0) return 'rank-gold'
  if (index === 1) return 'rank-silver'
  if (index === 2) return 'rank-bronze'
  return ''
}

function fmtAvg(avg) {
  if (avg === Infinity) return '-'
  return avg.toFixed(2)
}

function fmtSR(sr) {
  return sr.toFixed(1)
}

function PlayerName({ player, onClick }) {
  return (
    <span className="player-link" onClick={() => onClick(player)}>
      {player.name}
    </span>
  )
}

// ─── BATTING TAB ────────────────────────────────────────────────

function BattingTab({ battingStats, bowlingStats, onPlayerClick }) {
  const [subView, setSubView] = useState('orange-cap')

  const orangeCap = useMemo(() => getOrangeCapList(battingStats), [battingStats])
  const mostFours = useMemo(() => getMostFours(battingStats), [battingStats])
  const mostSixes = useMemo(() => getMostSixes(battingStats), [battingStats])
  const bestSR = useMemo(() => getBestStrikeRate(battingStats), [battingStats])
  const bestAvg = useMemo(() => getBestBattingAverage(battingStats), [battingStats])
  const highScores = useMemo(() => getHighestScores(battingStats), [battingStats])
  const thirtyPlus = useMemo(() => getMostThirtyPlus(battingStats), [battingStats])
  const ducks = useMemo(() => getMostDucks(battingStats), [battingStats])

  const handlePlayerClick = (p) => {
    const batStat = battingStats.find(b => b.name === p.name && b.teamId === p.teamId)
    const bowlStat = bowlingStats.find(b => b.name === p.name && b.teamId === p.teamId)
    onPlayerClick({ batting: batStat, bowling: bowlStat, name: p.name, team: p.team, teamId: p.teamId })
  }

  const subViews = [
    { id: 'orange-cap', label: 'Orange Cap' },
    { id: 'most-4s', label: 'Most 4s' },
    { id: 'most-6s', label: 'Most 6s' },
    { id: 'best-sr', label: 'Best SR' },
    { id: 'best-avg', label: 'Best Avg' },
    { id: 'high-scores', label: 'Top Scores' },
    { id: '30-plus', label: '30+ Scores' },
    { id: 'ducks', label: 'Ducks' },
  ]

  return (
    <>
      <div className="stats-sub-tabs">
        {subViews.map(sv => (
          <button
            key={sv.id}
            className={`chip ${subView === sv.id ? 'active' : ''}`}
            onClick={() => setSubView(sv.id)}
          >
            {sv.label}
          </button>
        ))}
      </div>

      {subView === 'orange-cap' && (
        <div className="card">
          <h2>
            <span className="cap-icon cap-orange">&#x1F3C6;</span>{' '}
            Orange Cap — Top Run Scorers
          </h2>
          <div className="table-wrapper">
            <table className="stats-table">
              <thead>
                <tr>
                  <th className="col-pos">#</th>
                  <th className="col-name">Player</th>
                  <th className="col-stat">M</th>
                  <th className="col-stat">Inn</th>
                  <th className="col-stat">R</th>
                  <th className="col-stat">B</th>
                  <th className="col-stat">Avg</th>
                  <th className="col-stat">SR</th>
                </tr>
              </thead>
              <tbody>
                {orangeCap.slice(0, 15).map((p, i) => (
                  <tr key={`${p.teamId}-${p.name}`} className={rankClass(i)}>
                    <td className="col-pos">{i === 0 ? '\u{1F3C6}' : i + 1}</td>
                    <td className="col-name">
                      <PlayerName player={p} onClick={handlePlayerClick} />
                      <span className="player-team-badge">{p.team}</span>
                    </td>
                    <td className="col-stat">{p.matches}</td>
                    <td className="col-stat">{p.innings}</td>
                    <td className="col-stat stat-highlight">{p.runs}</td>
                    <td className="col-stat">{p.balls}</td>
                    <td className="col-stat">{fmtAvg(p.average)}</td>
                    <td className="col-stat">{fmtSR(p.strikeRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subView === 'most-4s' && (
        <div className="card">
          <h2>Most Fours</h2>
          <div className="table-wrapper">
            <table className="stats-table">
              <thead>
                <tr>
                  <th className="col-pos">#</th>
                  <th className="col-name">Player</th>
                  <th className="col-stat">4s</th>
                  <th className="col-stat">Inn</th>
                </tr>
              </thead>
              <tbody>
                {mostFours.slice(0, 15).map((p, i) => (
                  <tr key={`${p.teamId}-${p.name}`} className={rankClass(i)}>
                    <td className="col-pos">{i + 1}</td>
                    <td className="col-name">
                      <PlayerName player={p} onClick={handlePlayerClick} />
                      <span className="player-team-badge">{p.team}</span>
                    </td>
                    <td className="col-stat stat-highlight">{p.fours}</td>
                    <td className="col-stat">{p.innings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subView === 'most-6s' && (
        <div className="card">
          <h2>Most Sixes</h2>
          <div className="table-wrapper">
            <table className="stats-table">
              <thead>
                <tr>
                  <th className="col-pos">#</th>
                  <th className="col-name">Player</th>
                  <th className="col-stat">6s</th>
                  <th className="col-stat">Inn</th>
                </tr>
              </thead>
              <tbody>
                {mostSixes.slice(0, 15).map((p, i) => (
                  <tr key={`${p.teamId}-${p.name}`} className={rankClass(i)}>
                    <td className="col-pos">{i + 1}</td>
                    <td className="col-name">
                      <PlayerName player={p} onClick={handlePlayerClick} />
                      <span className="player-team-badge">{p.team}</span>
                    </td>
                    <td className="col-stat stat-highlight">{p.sixes}</td>
                    <td className="col-stat">{p.innings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subView === 'best-sr' && (
        <div className="card">
          <h2>Best Strike Rate <span className="qualifier">(min. 10 balls faced)</span></h2>
          <div className="table-wrapper">
            <table className="stats-table">
              <thead>
                <tr>
                  <th className="col-pos">#</th>
                  <th className="col-name">Player</th>
                  <th className="col-stat">R</th>
                  <th className="col-stat">B</th>
                  <th className="col-stat">SR</th>
                </tr>
              </thead>
              <tbody>
                {bestSR.slice(0, 15).map((p, i) => (
                  <tr key={`${p.teamId}-${p.name}`} className={rankClass(i)}>
                    <td className="col-pos">{i + 1}</td>
                    <td className="col-name">
                      <PlayerName player={p} onClick={handlePlayerClick} />
                      <span className="player-team-badge">{p.team}</span>
                    </td>
                    <td className="col-stat">{p.runs}</td>
                    <td className="col-stat">{p.balls}</td>
                    <td className="col-stat stat-highlight">{fmtSR(p.strikeRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subView === 'best-avg' && (
        <div className="card">
          <h2>Best Batting Average <span className="qualifier">(min 2 innings)</span></h2>
          <div className="table-wrapper">
            <table className="stats-table">
              <thead>
                <tr>
                  <th className="col-pos">#</th>
                  <th className="col-name">Player</th>
                  <th className="col-stat">R</th>
                  <th className="col-stat">Inn</th>
                  <th className="col-stat">NO</th>
                  <th className="col-stat">Avg</th>
                </tr>
              </thead>
              <tbody>
                {bestAvg.slice(0, 15).map((p, i) => (
                  <tr key={`${p.teamId}-${p.name}`} className={rankClass(i)}>
                    <td className="col-pos">{i + 1}</td>
                    <td className="col-name">
                      <PlayerName player={p} onClick={handlePlayerClick} />
                      <span className="player-team-badge">{p.team}</span>
                    </td>
                    <td className="col-stat">{p.runs}</td>
                    <td className="col-stat">{p.innings}</td>
                    <td className="col-stat">{p.notOuts}</td>
                    <td className="col-stat stat-highlight">{fmtAvg(p.average)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subView === 'high-scores' && (
        <div className="card">
          <h2>Highest Individual Scores</h2>
          <div className="table-wrapper">
            <table className="stats-table">
              <thead>
                <tr>
                  <th className="col-pos">#</th>
                  <th className="col-name">Player</th>
                  <th className="col-stat">Score</th>
                  <th className="col-stat">B</th>
                  <th className="col-stat">4s</th>
                  <th className="col-stat">6s</th>
                  <th className="col-name">vs</th>
                </tr>
              </thead>
              <tbody>
                {highScores.slice(0, 20).map((s, i) => (
                  <tr key={`${i}-${s.name}`} className={rankClass(i)}>
                    <td className="col-pos">{i + 1}</td>
                    <td className="col-name">
                      <span className="player-link" onClick={() => {
                        const batStat = battingStats.find(b => b.name === s.name && b.teamId === s.teamId)
                        const bowlStat = bowlingStats.find(b => b.name === s.name && b.teamId === s.teamId)
                        onPlayerClick({ batting: batStat, bowling: bowlStat, name: s.name, team: s.team, teamId: s.teamId })
                      }}>
                        {s.name}
                      </span>
                      <span className="player-team-badge">{s.team}</span>
                    </td>
                    <td className="col-stat stat-highlight">{s.runs}{s.isOut ? '' : '*'}</td>
                    <td className="col-stat">{s.balls}</td>
                    <td className="col-stat">{s.fours}</td>
                    <td className="col-stat">{s.sixes}</td>
                    <td className="col-name">{s.vs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subView === '30-plus' && (
        <div className="card">
          <h2>Most 30+ Scores</h2>
          <div className="table-wrapper">
            <table className="stats-table">
              <thead>
                <tr>
                  <th className="col-pos">#</th>
                  <th className="col-name">Player</th>
                  <th className="col-stat">30+</th>
                  <th className="col-stat">Inn</th>
                </tr>
              </thead>
              <tbody>
                {thirtyPlus.slice(0, 15).map((p, i) => (
                  <tr key={`${p.teamId}-${p.name}`} className={rankClass(i)}>
                    <td className="col-pos">{i + 1}</td>
                    <td className="col-name">
                      <PlayerName player={p} onClick={handlePlayerClick} />
                      <span className="player-team-badge">{p.team}</span>
                    </td>
                    <td className="col-stat stat-highlight">{p.thirtyPlus}</td>
                    <td className="col-stat">{p.innings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subView === 'ducks' && (
        <div className="card">
          <h2>Most Ducks</h2>
          <div className="table-wrapper">
            <table className="stats-table">
              <thead>
                <tr>
                  <th className="col-pos">#</th>
                  <th className="col-name">Player</th>
                  <th className="col-stat">Ducks</th>
                  <th className="col-stat">Inn</th>
                </tr>
              </thead>
              <tbody>
                {ducks.slice(0, 15).map((p, i) => (
                  <tr key={`${p.teamId}-${p.name}`} className={rankClass(i)}>
                    <td className="col-pos">{i + 1}</td>
                    <td className="col-name">
                      <PlayerName player={p} onClick={handlePlayerClick} />
                      <span className="player-team-badge">{p.team}</span>
                    </td>
                    <td className="col-stat stat-highlight">{p.ducks}</td>
                    <td className="col-stat">{p.innings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

// ─── BOWLING TAB ────────────────────────────────────────────────

function BowlingTab({ bowlingStats, battingStats, matchData, onPlayerClick }) {
  const [subView, setSubView] = useState('purple-cap')

  const purpleCap = useMemo(() => getPurpleCapList(bowlingStats), [bowlingStats])
  const bestEconomy = useMemo(() => getBestEconomy(bowlingStats), [bowlingStats])
  const bestFigures = useMemo(() => getBestBowlingFigures(bowlingStats), [bowlingStats])
  const mostDots = useMemo(() => getMostDotBalls(bowlingStats), [bowlingStats])
  const mostMaidens = useMemo(() => getMostMaidens(bowlingStats), [bowlingStats])
  const expensiveOvers = useMemo(() => getMostExpensiveOvers(matchData), [matchData])

  const handlePlayerClick = (p) => {
    const batStat = battingStats.find(b => b.name === p.name && b.teamId === p.teamId)
    const bowlStat = bowlingStats.find(b => b.name === p.name && b.teamId === p.teamId)
    onPlayerClick({ batting: batStat, bowling: bowlStat, name: p.name, team: p.team, teamId: p.teamId })
  }

  const subViews = [
    { id: 'purple-cap', label: 'Purple Cap' },
    { id: 'best-econ', label: 'Best Economy' },
    { id: 'best-figures', label: 'Best Figures' },
    { id: 'dot-balls', label: 'Dot Balls' },
    { id: 'maidens', label: 'Maidens' },
    { id: 'expensive', label: 'Expensive Overs' },
  ]

  return (
    <>
      <div className="stats-sub-tabs">
        {subViews.map(sv => (
          <button
            key={sv.id}
            className={`chip ${subView === sv.id ? 'active' : ''}`}
            onClick={() => setSubView(sv.id)}
          >
            {sv.label}
          </button>
        ))}
      </div>

      {subView === 'purple-cap' && (
        <div className="card">
          <h2>
            <span className="cap-icon cap-purple">&#x1F3C6;</span>{' '}
            Purple Cap — Top Wicket Takers
          </h2>
          <div className="table-wrapper">
            <table className="stats-table">
              <thead>
                <tr>
                  <th className="col-pos">#</th>
                  <th className="col-name">Player</th>
                  <th className="col-stat">M</th>
                  <th className="col-stat">O</th>
                  <th className="col-stat">W</th>
                  <th className="col-stat">R</th>
                  <th className="col-stat">Avg</th>
                  <th className="col-stat">Ec</th>
                </tr>
              </thead>
              <tbody>
                {purpleCap.slice(0, 15).map((p, i) => (
                  <tr key={`${p.teamId}-${p.name}`} className={rankClass(i)}>
                    <td className="col-pos">{i === 0 ? '\u{1F3C6}' : i + 1}</td>
                    <td className="col-name">
                      <PlayerName player={p} onClick={handlePlayerClick} />
                      <span className="player-team-badge">{p.team}</span>
                    </td>
                    <td className="col-stat">{p.matches}</td>
                    <td className="col-stat">{p.overs}</td>
                    <td className="col-stat stat-highlight">{p.wickets}</td>
                    <td className="col-stat">{p.runs}</td>
                    <td className="col-stat">{p.wickets > 0 ? fmtAvg(p.bowlingAverage) : '-'}</td>
                    <td className="col-stat">{p.economy.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subView === 'best-econ' && (
        <div className="card">
          <h2>Best Economy Rate <span className="qualifier">(min 6 overs)</span></h2>
          <div className="table-wrapper">
            <table className="stats-table">
              <thead>
                <tr>
                  <th className="col-pos">#</th>
                  <th className="col-name">Player</th>
                  <th className="col-stat">O</th>
                  <th className="col-stat">R</th>
                  <th className="col-stat">Ec</th>
                </tr>
              </thead>
              <tbody>
                {bestEconomy.slice(0, 15).map((p, i) => (
                  <tr key={`${p.teamId}-${p.name}`} className={rankClass(i)}>
                    <td className="col-pos">{i + 1}</td>
                    <td className="col-name">
                      <PlayerName player={p} onClick={handlePlayerClick} />
                      <span className="player-team-badge">{p.team}</span>
                    </td>
                    <td className="col-stat">{p.overs}</td>
                    <td className="col-stat">{p.runs}</td>
                    <td className="col-stat stat-highlight">{p.economy.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subView === 'best-figures' && (
        <div className="card">
          <h2>Best Bowling Figures</h2>
          <div className="table-wrapper">
            <table className="stats-table">
              <thead>
                <tr>
                  <th className="col-pos">#</th>
                  <th className="col-name">Player</th>
                  <th className="col-stat">Fig</th>
                  <th className="col-stat">O</th>
                  <th className="col-name">vs</th>
                  <th className="col-stat">M#</th>
                </tr>
              </thead>
              <tbody>
                {bestFigures.slice(0, 20).map((f, i) => (
                  <tr key={`${i}-${f.name}`} className={rankClass(i)}>
                    <td className="col-pos">{i + 1}</td>
                    <td className="col-name">
                      <span className="player-link" onClick={() => handlePlayerClick(f)}>
                        {f.name}
                      </span>
                      <span className="player-team-badge">{f.team}</span>
                    </td>
                    <td className="col-stat stat-highlight">{f.figures}</td>
                    <td className="col-stat">{f.overs}</td>
                    <td className="col-name">{f.vs}</td>
                    <td className="col-stat">{f.matchNumber}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subView === 'dot-balls' && (
        <div className="card">
          <h2>Most Dot Balls</h2>
          <div className="table-wrapper">
            <table className="stats-table">
              <thead>
                <tr>
                  <th className="col-pos">#</th>
                  <th className="col-name">Player</th>
                  <th className="col-stat">Dots</th>
                  <th className="col-stat">O</th>
                </tr>
              </thead>
              <tbody>
                {mostDots.slice(0, 15).map((p, i) => (
                  <tr key={`${p.teamId}-${p.name}`} className={rankClass(i)}>
                    <td className="col-pos">{i + 1}</td>
                    <td className="col-name">
                      <PlayerName player={p} onClick={handlePlayerClick} />
                      <span className="player-team-badge">{p.team}</span>
                    </td>
                    <td className="col-stat stat-highlight">{p.dotBalls}</td>
                    <td className="col-stat">{p.overs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subView === 'maidens' && (
        <div className="card">
          <h2>Most Maiden Overs</h2>
          <div className="table-wrapper">
            <table className="stats-table">
              <thead>
                <tr>
                  <th className="col-pos">#</th>
                  <th className="col-name">Player</th>
                  <th className="col-stat">Maidens</th>
                  <th className="col-stat">O</th>
                </tr>
              </thead>
              <tbody>
                {mostMaidens.slice(0, 15).map((p, i) => (
                  <tr key={`${p.teamId}-${p.name}`} className={rankClass(i)}>
                    <td className="col-pos">{i + 1}</td>
                    <td className="col-name">
                      <PlayerName player={p} onClick={handlePlayerClick} />
                      <span className="player-team-badge">{p.team}</span>
                    </td>
                    <td className="col-stat stat-highlight">{p.maidens}</td>
                    <td className="col-stat">{p.overs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subView === 'expensive' && (
        <div className="card">
          <h2>Most Expensive Overs</h2>
          <div className="table-wrapper">
            <table className="stats-table">
              <thead>
                <tr>
                  <th className="col-pos">#</th>
                  <th className="col-name">Bowling</th>
                  <th className="col-stat">Runs</th>
                  <th className="col-name">vs</th>
                  <th className="col-stat">Ov#</th>
                  <th className="col-stat">M#</th>
                </tr>
              </thead>
              <tbody>
                {expensiveOvers.slice(0, 15).map((o, i) => (
                  <tr key={i} className={rankClass(i)}>
                    <td className="col-pos">{i + 1}</td>
                    <td className="col-name">{o.bowlingTeam}</td>
                    <td className="col-stat stat-highlight">{o.runs}</td>
                    <td className="col-name">{o.vs}</td>
                    <td className="col-stat">{o.overNumber}</td>
                    <td className="col-stat">{o.matchNumber}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

// ─── FIELDING TAB ───────────────────────────────────────────────

function FieldingTab({ matchData }) {
  const fieldingStats = useMemo(() => computeFieldingStats(matchData), [matchData])

  return (
    <div className="card">
      <h2>Fielding Summary by Team</h2>
      <p className="subtitle">Individual fielder credits are not tracked in the current data model</p>
      <div className="table-wrapper">
        <table className="stats-table">
          <thead>
            <tr>
              <th className="col-name">Team</th>
              <th className="col-stat">Catches</th>
              <th className="col-stat">Run Outs</th>
              <th className="col-stat">Stumpings</th>
              <th className="col-stat">Bowled</th>
              <th className="col-stat">LBW</th>
            </tr>
          </thead>
          <tbody>
            {fieldingStats.map((t, i) => (
              <tr key={t.teamId} className={rankClass(i)}>
                <td className="col-name">{t.team}</td>
                <td className="col-stat">{t.catches}</td>
                <td className="col-stat">{t.runOuts}</td>
                <td className="col-stat">{t.stumpings}</td>
                <td className="col-stat">{t.bowled}</td>
                <td className="col-stat">{t.lbw}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── TEAMS TAB ──────────────────────────────────────────────────

function TeamsTab({ matchData, teams }) {
  const teamStats = useMemo(() => computeTeamStats(matchData, teams), [matchData, teams])
  const highestTotals = useMemo(() => getHighestTeamTotals(matchData), [matchData])
  const lowestTotals = useMemo(() => getLowestTeamTotals(matchData), [matchData])
  const biggestWins = useMemo(() => getBiggestWins(matchData, teams), [matchData, teams])

  return (
    <>
      <div className="card">
        <h2>Team Batting</h2>
        <div className="table-wrapper">
          <table className="stats-table">
            <thead>
              <tr>
                <th className="col-name">Team</th>
                <th className="col-stat">M</th>
                <th className="col-stat">Runs</th>
                <th className="col-stat">Avg/Inn</th>
                <th className="col-stat">HS</th>
                <th className="col-stat">LS</th>
                <th className="col-stat">4s</th>
                <th className="col-stat">6s</th>
              </tr>
            </thead>
            <tbody>
              {teamStats.sort((a, b) => b.totalRuns - a.totalRuns).map(t => (
                <tr key={t.teamId}>
                  <td className="col-name">{t.team}</td>
                  <td className="col-stat">{t.matches}</td>
                  <td className="col-stat stat-highlight">{t.totalRuns}</td>
                  <td className="col-stat">{t.battingAvgPerInnings.toFixed(1)}</td>
                  <td className="col-stat">{t.highestTotal.runs}</td>
                  <td className="col-stat">{t.lowestTotal.runs}</td>
                  <td className="col-stat">{t.totalFours}</td>
                  <td className="col-stat">{t.totalSixes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Team Bowling</h2>
        <div className="table-wrapper">
          <table className="stats-table">
            <thead>
              <tr>
                <th className="col-name">Team</th>
                <th className="col-stat">M</th>
                <th className="col-stat">Wkts</th>
                <th className="col-stat">Avg/Inn</th>
                <th className="col-stat">Dots</th>
                <th className="col-stat">Wd</th>
                <th className="col-stat">NB</th>
              </tr>
            </thead>
            <tbody>
              {teamStats.sort((a, b) => b.totalWicketsTaken - a.totalWicketsTaken).map(t => (
                <tr key={t.teamId}>
                  <td className="col-name">{t.team}</td>
                  <td className="col-stat">{t.matches}</td>
                  <td className="col-stat stat-highlight">{t.totalWicketsTaken}</td>
                  <td className="col-stat">{t.bowlingAvgPerInnings.toFixed(1)}</td>
                  <td className="col-stat">{t.totalDotBalls}</td>
                  <td className="col-stat">{t.totalWides}</td>
                  <td className="col-stat">{t.totalNoBalls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Highest Team Totals</h2>
        <div className="table-wrapper">
          <table className="stats-table">
            <thead>
              <tr>
                <th className="col-pos">#</th>
                <th className="col-name">Team</th>
                <th className="col-stat">Score</th>
                <th className="col-stat">Ov</th>
                <th className="col-name">vs</th>
                <th className="col-stat">M#</th>
              </tr>
            </thead>
            <tbody>
              {highestTotals.slice(0, 10).map((t, i) => (
                <tr key={i} className={rankClass(i)}>
                  <td className="col-pos">{i + 1}</td>
                  <td className="col-name">{t.team}</td>
                  <td className="col-stat stat-highlight">{t.runs}/{t.wickets}</td>
                  <td className="col-stat">{t.overs}</td>
                  <td className="col-name">{t.vs}</td>
                  <td className="col-stat">{t.matchNumber}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Lowest Team Totals</h2>
        <div className="table-wrapper">
          <table className="stats-table">
            <thead>
              <tr>
                <th className="col-pos">#</th>
                <th className="col-name">Team</th>
                <th className="col-stat">Score</th>
                <th className="col-stat">Ov</th>
                <th className="col-name">vs</th>
                <th className="col-stat">M#</th>
              </tr>
            </thead>
            <tbody>
              {lowestTotals.slice(0, 10).map((t, i) => (
                <tr key={i} className={rankClass(i)}>
                  <td className="col-pos">{i + 1}</td>
                  <td className="col-name">{t.team}</td>
                  <td className="col-stat stat-highlight">{t.runs}/{t.wickets}</td>
                  <td className="col-stat">{t.overs}</td>
                  <td className="col-name">{t.vs}</td>
                  <td className="col-stat">{t.matchNumber}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {biggestWins.length > 0 && (
        <div className="card">
          <h2>Biggest Wins (by runs)</h2>
          <div className="table-wrapper">
            <table className="stats-table">
              <thead>
                <tr>
                  <th className="col-pos">#</th>
                  <th className="col-name">Winner</th>
                  <th className="col-stat">Margin</th>
                  <th className="col-name">vs</th>
                  <th className="col-stat">M#</th>
                </tr>
              </thead>
              <tbody>
                {biggestWins.slice(0, 10).map((w, i) => (
                  <tr key={i} className={rankClass(i)}>
                    <td className="col-pos">{i + 1}</td>
                    <td className="col-name">{w.winner}</td>
                    <td className="col-stat stat-highlight">{w.margin}</td>
                    <td className="col-name">{w.vs}</td>
                    <td className="col-stat">{w.matchNumber}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

// ─── RECORDS TAB ────────────────────────────────────────────────

function RecordsTab({ matchData, teams }) {
  const matchAggregates = useMemo(() => getHighestMatchAggregates(matchData), [matchData])
  const closestMatches = useMemo(() => getClosestMatches(matchData), [matchData])
  const extras = useMemo(() => getMostExtrasInInnings(matchData), [matchData])
  const followOn = useMemo(() => getFollowOnStats(matchData), [matchData])
  const superOvers = useMemo(() => getSuperOverRecords(matchData), [matchData])

  return (
    <>
      <div className="card">
        <h2>Highest Match Aggregates</h2>
        <div className="table-wrapper">
          <table className="stats-table">
            <thead>
              <tr>
                <th className="col-pos">#</th>
                <th className="col-name">Teams</th>
                <th className="col-stat">Total</th>
                <th className="col-stat">M#</th>
              </tr>
            </thead>
            <tbody>
              {matchAggregates.slice(0, 10).map((m, i) => (
                <tr key={i} className={rankClass(i)}>
                  <td className="col-pos">{i + 1}</td>
                  <td className="col-name">{m.team1} vs {m.team2}</td>
                  <td className="col-stat stat-highlight">{m.totalRuns}</td>
                  <td className="col-stat">{m.matchNumber}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {closestMatches.length > 0 && (
        <div className="card">
          <h2>Closest Matches</h2>
          <div className="table-wrapper">
            <table className="stats-table">
              <thead>
                <tr>
                  <th className="col-pos">#</th>
                  <th className="col-name">Match</th>
                  <th className="col-stat">Margin</th>
                  <th className="col-stat">M#</th>
                </tr>
              </thead>
              <tbody>
                {closestMatches.slice(0, 10).map((m, i) => (
                  <tr key={i} className={rankClass(i)}>
                    <td className="col-pos">{i + 1}</td>
                    <td className="col-name">{m.team1} vs {m.team2}</td>
                    <td className="col-stat stat-highlight">{m.margin === 0 ? 'SO/BC' : `${m.margin} runs`}</td>
                    <td className="col-stat">{m.matchNumber}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <h2>Most Extras in an Innings</h2>
        <div className="table-wrapper">
          <table className="stats-table">
            <thead>
              <tr>
                <th className="col-pos">#</th>
                <th className="col-name">Bowling</th>
                <th className="col-stat">Total</th>
                <th className="col-stat">Wd</th>
                <th className="col-stat">NB</th>
                <th className="col-stat">B</th>
                <th className="col-stat">LB</th>
                <th className="col-stat">M#</th>
              </tr>
            </thead>
            <tbody>
              {extras.slice(0, 10).map((e, i) => (
                <tr key={i} className={rankClass(i)}>
                  <td className="col-pos">{i + 1}</td>
                  <td className="col-name">{e.bowlingTeam}</td>
                  <td className="col-stat stat-highlight">{e.total}</td>
                  <td className="col-stat">{e.wides}</td>
                  <td className="col-stat">{e.noBalls}</td>
                  <td className="col-stat">{e.byes}</td>
                  <td className="col-stat">{e.legByes}</td>
                  <td className="col-stat">{e.matchNumber}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Follow-On Stats</h2>
        {followOn.total === 0 ? (
          <p className="text-muted">No follow-ons enforced this season.</p>
        ) : (
          <>
            <p>Follow-ons enforced: <strong>{followOn.total}</strong></p>
            {followOn.details.map((d, i) => (
              <div key={i} className="record-detail">
                <span>Match {d.matchNumber}: {d.team1} vs {d.team2}</span>
                <span className="text-muted">{d.result}</span>
              </div>
            ))}
          </>
        )}
      </div>

      {superOvers.length > 0 && (
        <div className="card">
          <h2>Super Over Records</h2>
          {superOvers.map((so, i) => (
            <div key={i} className="record-detail">
              <div>
                <strong>Match {so.matchNumber}:</strong> {so.team1} vs {so.team2}
              </div>
              <div className="text-muted">
                {so.battingFirst}: {so.innings1Runs} | {so.battingSecond}: {so.innings2Runs}
              </div>
              <div className="text-muted">{so.result}</div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ─── PARTICIPATION TAB ──────────────────────────────────────────

function ParticipationTab({ matchData, teams }) {
  const participation = useMemo(() => computeParticipation(matchData, teams), [matchData, teams])

  return (
    <>
      {teams.map(team => {
        const data = participation[team.id]
        if (!data) return null

        const sortedPlayers = [...data.squad].sort((a, b) => {
          return (data.playerMatches[b] || 0) - (data.playerMatches[a] || 0)
        })

        return (
          <div key={team.id} className="card">
            <h2>{data.team}</h2>
            <div className="participation-summary">
              <div className="participation-stat">
                <span className="participation-value">{data.uniquePlayers}/{data.squad.length}</span>
                <span className="participation-label">Players Used</span>
              </div>
              <div className="participation-stat">
                <span className="participation-value">{data.squadUtilization.toFixed(0)}%</span>
                <span className="participation-label">Utilization</span>
              </div>
              <div className="participation-stat">
                <span className="participation-value">{data.avgSubstitutionsPerMatch.toFixed(1)}</span>
                <span className="participation-label">Avg Subs/Match</span>
              </div>
            </div>

            <div className="participation-list">
              {sortedPlayers.map(name => {
                const played = data.playerMatches[name] || 0
                const pct = data.totalMatches > 0 ? (played / data.totalMatches) * 100 : 0

                return (
                  <div key={name} className={`participation-row ${played === 0 ? 'not-played' : ''}`}>
                    <span className="participation-name">{name}</span>
                    <div className="participation-bar-wrapper">
                      <div className="participation-bar" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="participation-count">{played}/{data.totalMatches}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </>
  )
}

// ─── PLAYER PROFILE MODAL ───────────────────────────────────────

function QualifierBadge({ current, required, unit }) {
  const qualifies = current >= required
  return (
    <span className={`qualifier-badge ${qualifies ? 'qualifier-met' : 'qualifier-unmet'}`}>
      {qualifies
        ? `Qualified (${current} ${unit})`
        : `${current}/${required} ${unit} to qualify`
      }
    </span>
  )
}

function PlayerModal({ player, onClose }) {
  const { batting, bowling, name, team } = player

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>&times;</button>

        <div className="modal-player-header">
          <h2>{name}</h2>
          <span className="player-team-badge">{team}</span>
        </div>

        {batting && (
          <div className="modal-section">
            <h3>Batting</h3>
            <div className="modal-stats-grid">
              <div className="modal-stat"><span className="modal-stat-value">{batting.matches}</span><span className="modal-stat-label">Matches</span></div>
              <div className="modal-stat"><span className="modal-stat-value">{batting.innings}</span><span className="modal-stat-label">Innings</span></div>
              <div className="modal-stat"><span className="modal-stat-value">{batting.runs}</span><span className="modal-stat-label">Runs</span></div>
              <div className="modal-stat"><span className="modal-stat-value">{batting.balls}</span><span className="modal-stat-label">Balls</span></div>
              <div className="modal-stat"><span className="modal-stat-value">{fmtAvg(batting.average)}</span><span className="modal-stat-label">Average</span></div>
              <div className="modal-stat"><span className="modal-stat-value">{fmtSR(batting.strikeRate)}</span><span className="modal-stat-label">SR</span></div>
              <div className="modal-stat"><span className="modal-stat-value">{batting.fours}</span><span className="modal-stat-label">4s</span></div>
              <div className="modal-stat"><span className="modal-stat-value">{batting.sixes}</span><span className="modal-stat-label">6s</span></div>
              <div className="modal-stat"><span className="modal-stat-value">{batting.highScore}{batting.highScoreNotOut ? '*' : ''}</span><span className="modal-stat-label">HS</span></div>
              <div className="modal-stat"><span className="modal-stat-value">{batting.notOuts}</span><span className="modal-stat-label">NO</span></div>
            </div>

            <div className="modal-qualifiers">
              <div className="modal-qualifier-row">
                <span className="modal-qualifier-stat">Strike Rate</span>
                <QualifierBadge current={batting.balls} required={10} unit="balls" />
              </div>
              <div className="modal-qualifier-row">
                <span className="modal-qualifier-stat">Batting Avg</span>
                <QualifierBadge current={batting.innings} required={2} unit="innings" />
              </div>
            </div>

            {batting.inningsList && batting.inningsList.length > 0 && (
              <>
                <h3>Innings Log</h3>
                <div className="table-wrapper">
                  <table className="stats-table">
                    <thead>
                      <tr>
                        <th className="col-stat">M#</th>
                        <th className="col-name">vs</th>
                        <th className="col-stat">R</th>
                        <th className="col-stat">B</th>
                        <th className="col-stat">4s</th>
                        <th className="col-stat">6s</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batting.inningsList.map((inn, i) => (
                        <tr key={i}>
                          <td className="col-stat">{inn.matchNumber}</td>
                          <td className="col-name">{inn.vs}</td>
                          <td className="col-stat stat-highlight">{inn.runs}{inn.isOut ? '' : '*'}</td>
                          <td className="col-stat">{inn.balls}</td>
                          <td className="col-stat">{inn.fours}</td>
                          <td className="col-stat">{inn.sixes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {bowling && bowling.inningsBowled > 0 && (
          <div className="modal-section">
            <h3>Bowling</h3>
            <div className="modal-stats-grid">
              <div className="modal-stat"><span className="modal-stat-value">{bowling.matches}</span><span className="modal-stat-label">Matches</span></div>
              <div className="modal-stat"><span className="modal-stat-value">{bowling.inningsBowled}</span><span className="modal-stat-label">Innings</span></div>
              <div className="modal-stat"><span className="modal-stat-value">{bowling.overs}</span><span className="modal-stat-label">Overs</span></div>
              <div className="modal-stat"><span className="modal-stat-value">{bowling.wickets}</span><span className="modal-stat-label">Wickets</span></div>
              <div className="modal-stat"><span className="modal-stat-value">{bowling.runs}</span><span className="modal-stat-label">Runs</span></div>
              <div className="modal-stat"><span className="modal-stat-value">{bowling.economy.toFixed(2)}</span><span className="modal-stat-label">Economy</span></div>
              <div className="modal-stat"><span className="modal-stat-value">{bowling.wickets > 0 ? fmtAvg(bowling.bowlingAverage) : '-'}</span><span className="modal-stat-label">Average</span></div>
              <div className="modal-stat"><span className="modal-stat-value">{bowling.bestFigures}</span><span className="modal-stat-label">BBI</span></div>
              <div className="modal-stat"><span className="modal-stat-value">{bowling.maidens}</span><span className="modal-stat-label">Maidens</span></div>
            </div>

            <div className="modal-qualifiers">
              <div className="modal-qualifier-row">
                <span className="modal-qualifier-stat">Economy Rate</span>
                <QualifierBadge current={bowling.overs} required={6} unit="overs" />
              </div>
            </div>

            {bowling.figuresList && bowling.figuresList.length > 0 && (
              <>
                <h3>Bowling Log</h3>
                <div className="table-wrapper">
                  <table className="stats-table">
                    <thead>
                      <tr>
                        <th className="col-stat">M#</th>
                        <th className="col-name">vs</th>
                        <th className="col-stat">Fig</th>
                        <th className="col-stat">O</th>
                        <th className="col-stat">Ec</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bowling.figuresList.map((f, i) => (
                        <tr key={i}>
                          <td className="col-stat">{f.matchNumber}</td>
                          <td className="col-name">{f.vs}</td>
                          <td className="col-stat stat-highlight">{f.figures}</td>
                          <td className="col-stat">{f.overs}</td>
                          <td className="col-stat">{f.overs > 0 ? (f.runs / f.overs).toFixed(2) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
