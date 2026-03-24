function initLeaderboard(nk: nkruntime.Nakama, logger: nkruntime.Logger): void {
  try {
    nk.leaderboardCreate(
      LEADERBOARD_ID,
      false,
      nkruntime.SortOrder.DESCENDING,
      nkruntime.Operator.INCREMENTAL
    );
    logger.info('Leaderboard "%s" created or already exists.', LEADERBOARD_ID);
  } catch (e) {
    logger.error('Failed to create leaderboard: %s', e);
  }
}

function afterAuthenticateDeviceHook(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  data: nkruntime.Session,
  request: nkruntime.AuthenticateDeviceRequest
): void {
  if (!data.created) return;
  initializePlayerStats(nk, logger, ctx.userId!);
}

function afterAuthenticateEmailHook(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  data: nkruntime.Session,
  request: nkruntime.AuthenticateEmailRequest
): void {
  if (!data.created) return;
  initializePlayerStats(nk, logger, ctx.userId!);
}

function initializePlayerStats(nk: nkruntime.Nakama, logger: nkruntime.Logger, userId: string): void {
  var initialStats: PlayerStats = {
    wins: 0,
    losses: 0,
    draws: 0,
    totalGames: 0,
    currentStreak: 0,
    bestStreak: 0,
  };

  try {
    nk.storageWrite([{
      collection: STATS_COLLECTION,
      key: STATS_KEY,
      userId: userId,
      value: initialStats as unknown as { [key: string]: any },
      permissionRead: 2,
      permissionWrite: 0,
    }]);
    logger.info('Initialized stats for new player %s', userId);
  } catch (e) {
    logger.error('Failed to initialize stats for %s: %s', userId, e);
  }
}

function updateLeaderboardAndStats(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  state: MatchState,
  winnerId: string,
  loserId: string,
  result: 'win' | 'draw'
): void {
  try {
    if (result === 'win') {
      var winnerName = state.players[winnerId] ? state.players[winnerId].displayName : '';
      var loserName = state.players[loserId] ? state.players[loserId].displayName : '';
      nk.leaderboardRecordWrite(LEADERBOARD_ID, winnerId, winnerName, 3, 0);
      nk.leaderboardRecordWrite(LEADERBOARD_ID, loserId, loserName, 0, 0);
    } else {
      var player1Name = state.players[winnerId] ? state.players[winnerId].displayName : '';
      var player2Name = state.players[loserId] ? state.players[loserId].displayName : '';
      nk.leaderboardRecordWrite(LEADERBOARD_ID, winnerId, player1Name, 1, 0);
      nk.leaderboardRecordWrite(LEADERBOARD_ID, loserId, player2Name, 1, 0);
    }

    updatePlayerStats(nk, logger, winnerId, result === 'win' ? 'win' : 'draw');
    updatePlayerStats(nk, logger, loserId, result === 'win' ? 'loss' : 'draw');

    logger.info('Leaderboard and stats updated for match result: %s', result);
  } catch (e) {
    logger.error('Failed to update leaderboard/stats: %s', e);
  }
}

function updatePlayerStats(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  userId: string,
  result: 'win' | 'loss' | 'draw'
): void {
  var stats: PlayerStats = {
    wins: 0,
    losses: 0,
    draws: 0,
    totalGames: 0,
    currentStreak: 0,
    bestStreak: 0,
  };

  try {
    var objects = nk.storageRead([{
      collection: STATS_COLLECTION,
      key: STATS_KEY,
      userId: userId,
    }]);

    if (objects.length > 0) {
      stats = objects[0].value as unknown as PlayerStats;
    }
  } catch (e) {
    logger.warn('Could not read stats for %s, using defaults: %s', userId, e);
  }

  stats.totalGames++;

  if (result === 'win') {
    stats.wins++;
    stats.currentStreak++;
    if (stats.currentStreak > stats.bestStreak) {
      stats.bestStreak = stats.currentStreak;
    }
  } else if (result === 'loss') {
    stats.losses++;
    stats.currentStreak = 0;
  } else {
    stats.draws++;
    stats.currentStreak = 0;
  }

  try {
    nk.storageWrite([{
      collection: STATS_COLLECTION,
      key: STATS_KEY,
      userId: userId,
      value: stats as unknown as { [key: string]: any },
      permissionRead: 2,
      permissionWrite: 0,
    }]);
  } catch (e) {
    logger.error('Failed to write stats for %s: %s', userId, e);
  }
}

var rpcGetLeaderboard: nkruntime.RpcFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  var limit = 20;

  if (payload) {
    try {
      var data = JSON.parse(payload);
      if (data.limit && data.limit > 0 && data.limit <= 100) {
        limit = data.limit;
      }
    } catch (e) {
      // use default limit
    }
  }

  var result = nk.leaderboardRecordsList(LEADERBOARD_ID, [], limit);
  var records = result.records || [];

  var enrichedRecords: any[] = [];
  for (var i = 0; i < records.length; i++) {
    var r = records[i];
    var record: any = {
      rank: i + 1,
      userId: r.ownerId,
      username: r.username,
      score: r.score,
      numScore: r.numScore,
    };

    try {
      var statObjects = nk.storageRead([{
        collection: STATS_COLLECTION,
        key: STATS_KEY,
        userId: r.ownerId,
      }]);

      if (statObjects.length > 0) {
        record.stats = statObjects[0].value;
      }
    } catch (e) {
      // skip stats enrichment on error
    }

    enrichedRecords.push(record);
  }

  return JSON.stringify({ records: enrichedRecords });
};

var rpcGetPlayerStats: nkruntime.RpcFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  var targetUserId = ctx.userId!;

  if (payload) {
    try {
      var data = JSON.parse(payload);
      if (data.userId) {
        targetUserId = data.userId;
      }
    } catch (e) {
      // use own userId
    }
  }

  try {
    var objects = nk.storageRead([{
      collection: STATS_COLLECTION,
      key: STATS_KEY,
      userId: targetUserId,
    }]);

    if (objects.length > 0) {
      return JSON.stringify({ userId: targetUserId, stats: objects[0].value });
    }
  } catch (e) {
    logger.error('Failed to read stats for %s: %s', targetUserId, e);
  }

  return JSON.stringify({
    userId: targetUserId,
    stats: { wins: 0, losses: 0, draws: 0, totalGames: 0, currentStreak: 0, bestStreak: 0 },
  });
};
