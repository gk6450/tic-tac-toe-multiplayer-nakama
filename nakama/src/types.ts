var OpCode = {
  START: 1,
  MOVE: 2,
  STATE_UPDATE: 3,
  GAME_OVER: 4,
  TIMER_UPDATE: 5,
  OPPONENT_LEFT: 6,
};

type GameMode = 'classic' | 'timed';
type GamePhase = 'waiting' | 'playing' | 'finished';

interface PlayerInfo {
  displayName: string;
  mark: number;
  presence: nkruntime.Presence;
}

interface MatchState {
  board: number[];
  players: { [userId: string]: PlayerInfo };
  playerCount: number;
  currentTurn: string;
  phase: GamePhase;
  winner: string | null;
  winnerMark: number;
  gameMode: GameMode;
  turnDeadline: number;
  turnDuration: number;
  emptyTicks: number;
  matchId: string;
}

interface MoveMessage {
  position: number;
}

interface MatchLabel {
  open: number;
  mode: GameMode;
  playerCount: number;
}

interface PlayerStats {
  wins: number;
  losses: number;
  draws: number;
  totalGames: number;
  currentStreak: number;
  bestStreak: number;
}

var WIN_LINES: number[][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

var DEFAULT_TURN_DURATION = 30;
var EMPTY_TICKS_BEFORE_CLOSE = 100;
var LEADERBOARD_ID = 'tic_tac_toe_wins';
var STATS_COLLECTION = 'player_stats';
var STATS_KEY = 'stats';
