function checkWinner(board: number[]): { winner: number; line: number[] } | null {
  for (var i = 0; i < WIN_LINES.length; i++) {
    var line = WIN_LINES[i];
    var a = line[0], b = line[1], c = line[2];
    if (board[a] !== 0 && board[a] === board[b] && board[b] === board[c]) {
      return { winner: board[a], line: line };
    }
  }
  return null;
}

function isBoardFull(board: number[]): boolean {
  for (var i = 0; i < board.length; i++) {
    if (board[i] === 0) return false;
  }
  return true;
}

function getUserIdByMark(state: MatchState, mark: number): string | null {
  for (var userId in state.players) {
    if (state.players[userId].mark === mark) return userId;
  }
  return null;
}

function getOpponentUserId(state: MatchState, userId: string): string | null {
  for (var uid in state.players) {
    if (uid !== userId) return uid;
  }
  return null;
}

function getPlayerCount(state: MatchState): number {
  var count = 0;
  for (var _uid in state.players) {
    count++;
  }
  return count;
}

var matchInit: nkruntime.MatchInitFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  params: { [key: string]: string }
): { state: nkruntime.MatchState; tickRate: number; label: string } {
  var gameMode: GameMode = (params && params['mode'] === 'timed') ? 'timed' : 'classic';
  var turnDuration = (params && params['turnDuration'])
    ? parseInt(params['turnDuration'])
    : DEFAULT_TURN_DURATION;

  var state: MatchState = {
    board: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    players: {},
    playerCount: 0,
    currentTurn: '',
    phase: 'waiting',
    winner: null,
    winnerMark: 0,
    gameMode: gameMode,
    turnDeadline: 0,
    turnDuration: turnDuration,
    emptyTicks: 0,
    matchId: ctx.matchId || '',
  };

  var label: MatchLabel = {
    open: 1,
    mode: gameMode,
    playerCount: 0,
  };

  logger.info('Match created: %s, mode: %s', ctx.matchId, gameMode);

  return {
    state: state,
    tickRate: 1,
    label: JSON.stringify(label),
  };
};

var matchJoinAttempt: nkruntime.MatchJoinAttemptFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  presence: nkruntime.Presence,
  metadata: { [key: string]: any }
): { state: nkruntime.MatchState; accept: boolean; rejectMessage?: string } | null {
  var s = state as MatchState;

  if (s.phase === 'playing' || s.phase === 'finished') {
    return { state: s, accept: false, rejectMessage: 'Match already in progress.' };
  }

  if (s.playerCount >= 2) {
    return { state: s, accept: false, rejectMessage: 'Match is full.' };
  }

  if (s.players[presence.userId]) {
    return { state: s, accept: true };
  }

  logger.info('Player %s attempting to join match %s', presence.userId, ctx.matchId);
  return { state: s, accept: true };
};

var matchJoin: nkruntime.MatchJoinFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  presences: nkruntime.Presence[]
): { state: nkruntime.MatchState } | null {
  var s = state as MatchState;

  for (var i = 0; i < presences.length; i++) {
    var presence = presences[i];

    if (s.players[presence.userId]) {
      s.players[presence.userId].presence = presence;
      logger.info('Player %s rejoined match %s', presence.userId, ctx.matchId);
      continue;
    }

    var mark = s.playerCount === 0 ? 1 : 2;
    var account = nk.accountGetId(presence.userId);
    var displayName = (account.user && account.user.displayName)
      || (account.user && account.user.username)
      || presence.userId;

    s.players[presence.userId] = {
      displayName: displayName,
      mark: mark,
      presence: presence,
    };
    s.playerCount++;

    logger.info('Player %s (%s) joined as %s', presence.userId, displayName, mark === 1 ? 'X' : 'O');
  }

  var label: MatchLabel = {
    open: s.playerCount < 2 ? 1 : 0,
    mode: s.gameMode,
    playerCount: s.playerCount,
  };
  dispatcher.matchLabelUpdate(JSON.stringify(label));

  if (s.playerCount === 2 && s.phase === 'waiting') {
    s.phase = 'playing';

    var xUserId = getUserIdByMark(s, 1);
    if (xUserId) {
      s.currentTurn = xUserId;
    }

    if (s.gameMode === 'timed') {
      s.turnDeadline = Date.now() + s.turnDuration * 1000;
    }

    var playerAssignments: { [userId: string]: { mark: number; displayName: string } } = {};
    for (var uid in s.players) {
      playerAssignments[uid] = { mark: s.players[uid].mark, displayName: s.players[uid].displayName };
    }

    var startMessage = JSON.stringify({
      board: s.board,
      currentTurn: s.currentTurn,
      players: playerAssignments,
      gameMode: s.gameMode,
      turnDuration: s.turnDuration,
    });

    dispatcher.broadcastMessage(OpCode.START, startMessage, null, null, true);
    logger.info('Match %s started!', ctx.matchId);
  }

  return { state: s };
};

var matchLeave: nkruntime.MatchLeaveFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  presences: nkruntime.Presence[]
): { state: nkruntime.MatchState } | null {
  var s = state as MatchState;

  for (var i = 0; i < presences.length; i++) {
    var presence = presences[i];
    logger.info('Player %s left match %s', presence.userId, ctx.matchId);

    if (s.phase === 'playing') {
      var opponentId = getOpponentUserId(s, presence.userId);

      if (opponentId && s.players[opponentId]) {
        s.phase = 'finished';
        s.winner = opponentId;
        s.winnerMark = s.players[opponentId].mark;

        var gameOverMessage = JSON.stringify({
          winner: opponentId,
          winnerMark: s.winnerMark,
          board: s.board,
          reason: 'opponent_left',
          winnerName: s.players[opponentId].displayName,
        });

        dispatcher.broadcastMessage(OpCode.OPPONENT_LEFT, gameOverMessage, null, null, true);
        updateLeaderboardAndStats(nk, logger, s, opponentId, presence.userId, 'win');
      }
    }

    delete s.players[presence.userId];
    s.playerCount = getPlayerCount(s);
  }

  if (s.playerCount <= 0) {
    return null;
  }

  return { state: s };
};

var matchLoop: nkruntime.MatchLoopFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  messages: nkruntime.MatchMessage[]
): { state: nkruntime.MatchState } | null {
  var s = state as MatchState;

  if (s.phase === 'finished') {
    s.emptyTicks++;
    if (s.emptyTicks > 10) {
      return null;
    }
    return { state: s };
  }

  if (s.phase === 'waiting') {
    if (s.playerCount === 0) {
      s.emptyTicks++;
      if (s.emptyTicks > EMPTY_TICKS_BEFORE_CLOSE) {
        logger.info('Match %s closed due to inactivity.', ctx.matchId);
        return null;
      }
    }
    return { state: s };
  }

  // phase === 'playing'

  // Timer check for timed mode
  if (s.gameMode === 'timed' && s.turnDeadline > 0) {
    var remainingMs = s.turnDeadline - Date.now();

    if (remainingMs <= 0) {
      var timeoutOpponent = getOpponentUserId(s, s.currentTurn);
      if (timeoutOpponent && s.players[timeoutOpponent]) {
        s.phase = 'finished';
        s.winner = timeoutOpponent;
        s.winnerMark = s.players[timeoutOpponent].mark;

        var timeoutMsg = JSON.stringify({
          winner: timeoutOpponent,
          winnerMark: s.winnerMark,
          board: s.board,
          reason: 'timeout',
          winnerName: s.players[timeoutOpponent].displayName,
          loserName: s.players[s.currentTurn] ? s.players[s.currentTurn].displayName : '',
        });

        dispatcher.broadcastMessage(OpCode.GAME_OVER, timeoutMsg, null, null, true);
        updateLeaderboardAndStats(nk, logger, s, timeoutOpponent, s.currentTurn, 'win');
        logger.info('Player %s timed out in match %s', s.currentTurn, ctx.matchId);
      }
      return { state: s };
    }

    var timerMessage = JSON.stringify({
      remainingSeconds: Math.ceil(remainingMs / 1000),
      currentTurn: s.currentTurn,
    });
    dispatcher.broadcastMessage(OpCode.TIMER_UPDATE, timerMessage, null, null, true);
  }

  // Process move messages
  for (var mi = 0; mi < messages.length; mi++) {
    var message = messages[mi];

    if (message.opCode !== OpCode.MOVE) {
      logger.warn('Unknown op code: %d from %s', message.opCode, message.sender.userId);
      continue;
    }

    if (message.sender.userId !== s.currentTurn) {
      logger.warn('Out-of-turn move from %s, current turn: %s', message.sender.userId, s.currentTurn);
      continue;
    }

    var moveData: MoveMessage;
    try {
      moveData = JSON.parse(nk.binaryToString(message.data));
    } catch (e) {
      logger.error('Failed to parse move data from %s', message.sender.userId);
      continue;
    }

    var position = moveData.position;
    if (position < 0 || position > 8 || position !== Math.floor(position)) {
      logger.warn('Invalid move position %d from %s', position, message.sender.userId);
      continue;
    }

    if (s.board[position] !== 0) {
      logger.warn('Cell %d already occupied, move rejected from %s', position, message.sender.userId);
      continue;
    }

    var playerMark = s.players[message.sender.userId].mark;
    s.board[position] = playerMark;

    logger.info('Player %s placed %s at position %d', message.sender.userId, playerMark === 1 ? 'X' : 'O', position);

    var winResult = checkWinner(s.board);
    if (winResult) {
      s.phase = 'finished';
      var winnerUserId = getUserIdByMark(s, winResult.winner)!;
      var loserUserId = getOpponentUserId(s, winnerUserId)!;
      s.winner = winnerUserId;
      s.winnerMark = winResult.winner;

      var winMsg = JSON.stringify({
        winner: winnerUserId,
        winnerMark: winResult.winner,
        board: s.board,
        reason: 'win',
        winningLine: winResult.line,
        winnerName: s.players[winnerUserId] ? s.players[winnerUserId].displayName : '',
        loserName: s.players[loserUserId] ? s.players[loserUserId].displayName : '',
      });

      dispatcher.broadcastMessage(OpCode.GAME_OVER, winMsg, null, null, true);
      updateLeaderboardAndStats(nk, logger, s, winnerUserId, loserUserId, 'win');
      logger.info('Player %s wins match %s!', winnerUserId, ctx.matchId);
      return { state: s };
    }

    if (isBoardFull(s.board)) {
      s.phase = 'finished';
      s.winner = null;
      s.winnerMark = 0;

      var playerIds: string[] = [];
      for (var pid in s.players) {
        playerIds.push(pid);
      }

      var drawMsg = JSON.stringify({
        winner: null,
        winnerMark: 0,
        board: s.board,
        reason: 'draw',
      });

      dispatcher.broadcastMessage(OpCode.GAME_OVER, drawMsg, null, null, true);
      if (playerIds.length === 2) {
        updateLeaderboardAndStats(nk, logger, s, playerIds[0], playerIds[1], 'draw');
      }
      logger.info('Match %s ended in a draw!', ctx.matchId);
      return { state: s };
    }

    var moveOpponent = getOpponentUserId(s, message.sender.userId);
    if (moveOpponent) {
      s.currentTurn = moveOpponent;
    }

    if (s.gameMode === 'timed') {
      s.turnDeadline = Date.now() + s.turnDuration * 1000;
    }

    var stateMessage = JSON.stringify({
      board: s.board,
      currentTurn: s.currentTurn,
      lastMove: { position: position, mark: playerMark, userId: message.sender.userId },
    });

    dispatcher.broadcastMessage(OpCode.STATE_UPDATE, stateMessage, null, null, true);
  }

  return { state: s };
};

var matchTerminate: nkruntime.MatchTerminateFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  graceSeconds: number
): { state: nkruntime.MatchState } | null {
  logger.info('Match %s terminating, grace period: %d seconds', ctx.matchId, graceSeconds);

  var shutdownMessage = JSON.stringify({
    reason: 'server_shutdown',
    graceSeconds: graceSeconds,
  });
  dispatcher.broadcastMessage(OpCode.GAME_OVER, shutdownMessage, null, null, true);

  return { state: state };
};

var matchSignal: nkruntime.MatchSignalFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  data: string
): { state: nkruntime.MatchState; data?: string } | null {
  logger.info('Match %s received signal: %s', ctx.matchId, data);
  return { state: state, data: 'signal_received' };
};
