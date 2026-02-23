import { getBallClass } from '../lib/ballDisplay'

export default function MatchScorecard({ matchState }) {
  if (!matchState) return null

  const { innings, team1, team2, result, superOver, cumulativeScores,
    cumulativeBoundaries, followOnEnforced, substitutions } = matchState

  function getOrdinal(n) {
    const s = ['th', 'st', 'nd', 'rd']
    const v = n % 100
    return n + (s[(v - 20) % 10] || s[v] || s[0])
  }

  return (
    <div className="scorecard">
      {/* Result */}
      {result && <div className="scorecard-result">{result}</div>}

      {/* Innings Cards */}
      {innings.map((inn, idx) => {
        if (!inn || !inn.batsmen || inn.batsmen.length === 0) return null
        return (
          <div key={idx} className="scorecard-innings">
            <div className="scorecard-innings-header">
              <h3>{inn.battingTeam} — {getOrdinal(idx + 1)} Innings</h3>
              <span className="scorecard-total">
                {inn.totalRuns}/{inn.wickets} ({inn.oversCompleted}.{inn.ballsInCurrentOver} ov)
              </span>
            </div>

            {/* Batting */}
            <div className="scorecard-section">
              <table className="scorecard-table">
                <thead>
                  <tr>
                    <th className="col-name">Batter</th>
                    <th className="col-dismissal">How Out</th>
                    <th className="col-stat">R</th>
                    <th className="col-stat">B</th>
                    <th className="col-stat">4s</th>
                    <th className="col-stat">6s</th>
                    <th className="col-stat">SR</th>
                  </tr>
                </thead>
                <tbody>
                  {inn.batsmen.map((bat, bIdx) => (
                    <tr key={bIdx} className={bat.isOut ? 'out' : 'not-out'}>
                      <td className="col-name">{bat.name}</td>
                      <td className="col-dismissal">{bat.isOut ? bat.dismissal : 'not out'}</td>
                      <td className="col-stat">{bat.runs}</td>
                      <td className="col-stat">{bat.balls}</td>
                      <td className="col-stat">{bat.fours}</td>
                      <td className="col-stat">{bat.sixes}</td>
                      <td className="col-stat">{bat.balls > 0 ? ((bat.runs / bat.balls) * 100).toFixed(1) : '0.0'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Extras */}
            <div className="scorecard-extras">
              Extras: Wd {inn.extras.wides}, NB {inn.extras.noBalls}, B {inn.extras.byes}, LB {inn.extras.legByes}
              {' '}= {inn.extras.wides + inn.extras.noBalls + inn.extras.byes + inn.extras.legByes}
            </div>

            {/* Bowling */}
            <div className="scorecard-section">
              <table className="scorecard-table">
                <thead>
                  <tr>
                    <th className="col-name">Bowler</th>
                    <th className="col-stat">O</th>
                    <th className="col-stat">M</th>
                    <th className="col-stat">R</th>
                    <th className="col-stat">W</th>
                    <th className="col-stat">Econ</th>
                  </tr>
                </thead>
                <tbody>
                  {inn.bowlers.map((bowl, bIdx) => (
                    <tr key={bIdx}>
                      <td className="col-name">{bowl.name}</td>
                      <td className="col-stat">{bowl.overs}</td>
                      <td className="col-stat">{bowl.maidens}</td>
                      <td className="col-stat">{bowl.runs}</td>
                      <td className="col-stat">{bowl.wickets}</td>
                      <td className="col-stat">{bowl.overs > 0 ? (bowl.runs / bowl.overs).toFixed(1) : '0.0'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Fall of Wickets */}
            {inn.fallOfWickets && inn.fallOfWickets.length > 0 && (
              <div className="scorecard-fow">
                <span className="fow-label">Fall of Wickets: </span>
                {inn.fallOfWickets.map((fow, fIdx) => (
                  <span key={fIdx} className="fow-entry">
                    {fow.wickets}-{fow.runs} ({fow.batsmanName}, {fow.overs})
                    {fIdx < inn.fallOfWickets.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </div>
            )}

            {/* Overs */}
            {inn.allOvers && inn.allOvers.length > 0 && (
              <div className="scorecard-overs">
                {inn.allOvers.map((over, oIdx) => (
                  <div key={oIdx} className="scorecard-over-row">
                    <span className="over-number">Ov {oIdx + 1}</span>
                    <span className="over-balls">
                      {over.map((ball, bI) => (
                        <span key={bI} className={`ball-badge small ${getBallClass(ball)}`}>{ball}</span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Match Summary */}
      <div className="scorecard-summary">
        <h3>Match Summary</h3>
        <div className="cumulative-row">
          <span>{team1}</span>
          <span className="cumulative-total">{cumulativeScores?.team1 ?? 0}</span>
        </div>
        <div className="cumulative-row">
          <span>{team2}</span>
          <span className="cumulative-total">{cumulativeScores?.team2 ?? 0}</span>
        </div>

        {cumulativeBoundaries && (
          <div className="scorecard-boundaries">
            <div className="cumulative-row">
              <span>{team1} boundaries</span>
              <span>{cumulativeBoundaries.team1?.fours ?? 0} fours, {cumulativeBoundaries.team1?.sixes ?? 0} sixes</span>
            </div>
            <div className="cumulative-row">
              <span>{team2} boundaries</span>
              <span>{cumulativeBoundaries.team2?.fours ?? 0} fours, {cumulativeBoundaries.team2?.sixes ?? 0} sixes</span>
            </div>
          </div>
        )}

        {followOnEnforced && (
          <div className="scorecard-follow-on">Follow-on enforced</div>
        )}

        {superOver && (
          <div className="scorecard-super-over">
            <h4>Super Over</h4>

            {/* Innings 1 */}
            <div className="so-scorecard-innings">
              <div className="so-scorecard-header">
                <span className="so-scorecard-team">{superOver.battingFirst}</span>
                <span className="so-scorecard-score">
                  {superOver.innings1?.runs}/{superOver.innings1?.wickets}
                  {' '}({superOver.innings1?.balls} balls)
                </span>
              </div>
              {superOver.team2Bowler && (
                <div className="so-scorecard-bowler">Bowler: {superOver.team2Bowler}</div>
              )}
              {superOver.team1Batsmen?.length > 0 && (
                <div className="so-scorecard-batsmen">Batsmen: {superOver.team1Batsmen.join(', ')}</div>
              )}
              {superOver.innings1?.ballLog?.length > 0 && (
                <div className="super-over-log" style={{ justifyContent: 'flex-start', margin: '8px 0' }}>
                  {superOver.innings1.ballLog.map((ball, i) => (
                    <span key={i} className={`ball-badge small ${getBallClass(ball)}`}>{ball}</span>
                  ))}
                </div>
              )}
              {superOver.innings1?.extras && (
                <div className="so-scorecard-extras">
                  Extras: Wd {superOver.innings1.extras.wides}, NB {superOver.innings1.extras.noBalls},
                  B {superOver.innings1.extras.byes}, LB {superOver.innings1.extras.legByes}
                </div>
              )}
            </div>

            {/* Innings 2 */}
            <div className="so-scorecard-innings">
              <div className="so-scorecard-header">
                <span className="so-scorecard-team">{superOver.battingSecond}</span>
                <span className="so-scorecard-score">
                  {superOver.innings2?.runs}/{superOver.innings2?.wickets}
                  {' '}({superOver.innings2?.balls} balls)
                </span>
              </div>
              {superOver.innings2?.target > 0 && (
                <div className="so-scorecard-target">Target: {superOver.innings2.target}</div>
              )}
              {superOver.team1Bowler && (
                <div className="so-scorecard-bowler">Bowler: {superOver.team1Bowler}</div>
              )}
              {superOver.team2Batsmen?.length > 0 && (
                <div className="so-scorecard-batsmen">Batsmen: {superOver.team2Batsmen.join(', ')}</div>
              )}
              {superOver.innings2?.ballLog?.length > 0 && (
                <div className="super-over-log" style={{ justifyContent: 'flex-start', margin: '8px 0' }}>
                  {superOver.innings2.ballLog.map((ball, i) => (
                    <span key={i} className={`ball-badge small ${getBallClass(ball)}`}>{ball}</span>
                  ))}
                </div>
              )}
              {superOver.innings2?.extras && (
                <div className="so-scorecard-extras">
                  Extras: Wd {superOver.innings2.extras.wides}, NB {superOver.innings2.extras.noBalls},
                  B {superOver.innings2.extras.byes}, LB {superOver.innings2.extras.legByes}
                </div>
              )}
            </div>

            {/* Boundary count comparison */}
            {cumulativeBoundaries && (
              <div className="so-boundary-comparison">
                <span className="so-scorecard-extras">
                  Boundary count: {team1} {(cumulativeBoundaries.team1?.fours ?? 0) + (cumulativeBoundaries.team1?.sixes ?? 0) + (superOver.innings1?.fours ?? 0) + (superOver.innings2?.fours ?? 0)} vs {team2} {(cumulativeBoundaries.team2?.fours ?? 0) + (cumulativeBoundaries.team2?.sixes ?? 0)}
                </span>
              </div>
            )}
          </div>
        )}

        {substitutions && (substitutions.team1?.length > 0 || substitutions.team2?.length > 0) && (
          <div className="scorecard-subs">
            <h4>Substitutions</h4>
            {substitutions.team1?.map((sub, i) => (
              <div key={`t1-${i}`} className="sub-entry">{team1}: {sub.in} in for {sub.out}</div>
            ))}
            {substitutions.team2?.map((sub, i) => (
              <div key={`t2-${i}`} className="sub-entry">{team2}: {sub.in} in for {sub.out}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
