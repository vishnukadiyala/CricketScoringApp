// NCC Edition 5 match constants
export const MAX_OVERS_PER_BOWLER = 3
export const MAX_WICKETS = 10
export const POWERPLAY_OVERS = 3
export const BALLS_PER_OVER = 6
export const DEFAULT_OVERS_PER_INNINGS = 12
export const MIN_SQUAD_SIZE = 8
export const MAX_SQUAD_SIZE = 15
export const PLAYING_XI = 11
export const MIN_SUBSTITUTIONS = 1
export const MAX_SUBSTITUTIONS = 5
export const SUPER_OVER_BALLS = 6
export const SUPER_OVER_WICKETS = 2
export const SUPER_OVER_BATSMEN = 3

// Follow-on threshold: team 2's score must be less than this fraction of team 1's score.
// NCC Edition 5 uses 50% (0.5). Traditional Test cricket uses a fixed-run deficit instead.
// Adjust this value if the tournament rules specify a different threshold.
export const FOLLOW_ON_THRESHOLD = 0.5

// Max undo history to keep in memory
export const MAX_UNDO_HISTORY = 20

// Tournament constants
export const LEAGUE_MATCHES = 6
export const NUM_TEAMS = 3
export const POINTS_WIN = 2
export const POINTS_TIE = 1
export const POINTS_LOSS = 0
