export const OpCode = {
  START: 1,
  MOVE: 2,
  STATE_UPDATE: 3,
  GAME_OVER: 4,
  TIMER_UPDATE: 5,
  OPPONENT_LEFT: 6,
} as const;

export type GameMode = 'classic' | 'timed';

export interface PlayerAssignment {
  mark: number;
  displayName: string;
}

export interface StartMessage {
  board: number[];
  currentTurn: string;
  players: Record<string, PlayerAssignment>;
  gameMode: GameMode;
  turnDuration: number;
}

export interface StateUpdateMessage {
  board: number[];
  currentTurn: string;
  lastMove: { position: number; mark: number; userId: string };
}

export interface GameOverMessage {
  winner: string | null;
  winnerMark: number;
  board: number[];
  reason: 'win' | 'draw' | 'timeout' | 'opponent_left' | 'server_shutdown';
  winningLine?: number[];
  winnerName?: string;
  loserName?: string;
}

export interface TimerUpdateMessage {
  remainingSeconds: number;
  currentTurn: string;
}

export interface MatchInfo {
  matchId: string;
  playerCount: number;
  label: { open: boolean; mode: GameMode; playerCount: number } | null;
}

export interface PlayerStats {
  wins: number;
  losses: number;
  draws: number;
  totalGames: number;
  currentStreak: number;
  bestStreak: number;
}

export interface LeaderboardRecord {
  rank: number;
  userId: string;
  username: string;
  score: number;
  numScore: number;
  stats?: PlayerStats;
}
