var matchmakerMatched: nkruntime.MatchmakerMatchedFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  matches: nkruntime.MatchmakerResult[]
): string {
  var mode: GameMode = 'classic';
  var turnDuration = DEFAULT_TURN_DURATION.toString();
  if (matches.length > 0 && matches[0].properties) {
    var modeStr = matches[0].properties['mode'];
    if (modeStr === 'timed') {
      mode = 'timed';
    }
    var td = matches[0].properties['turnDuration'];
    if (td) {
      turnDuration = td.toString();
    }
  }

  logger.info('Matchmaker matched %d players, mode: %s, turnDuration: %s', matches.length, mode, turnDuration);

  for (var i = 0; i < matches.length; i++) {
    logger.info(
      'Matched user %s (%s)',
      matches[i].presence.userId,
      matches[i].presence.username
    );
  }

  var matchId = nk.matchCreate('tic-tac-toe', { mode: mode, turnDuration: turnDuration });
  logger.info('Created match %s for matched players', matchId);
  return matchId;
};

var rpcCreateMatch: nkruntime.RpcFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  var mode: GameMode = 'classic';
  var turnDuration = DEFAULT_TURN_DURATION.toString();

  if (payload) {
    try {
      var data = JSON.parse(payload);
      if (data.mode === 'timed') {
        mode = 'timed';
      }
      if (data.turnDuration) {
        turnDuration = data.turnDuration.toString();
      }
    } catch (e) {
      logger.error('Failed to parse create_match payload: %s', payload);
    }
  }

  var matchId = nk.matchCreate('tic-tac-toe', {
    mode: mode,
    turnDuration: turnDuration,
  });

  logger.info('RPC create_match: created %s (mode: %s)', matchId, mode);

  return JSON.stringify({ matchId: matchId, mode: mode });
};

var rpcLoginWithUsername: nkruntime.RpcFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  if (!payload) {
    throw Error('Username and password are required');
  }

  var data: { username: string; password: string };
  try {
    data = JSON.parse(payload);
  } catch (e) {
    throw Error('Invalid payload');
  }

  if (!data.username || !data.password) {
    throw Error('Username and password are required');
  }

  var users = nk.usersGetUsername([data.username]);
  if (!users || users.length === 0) {
    throw Error('User not found');
  }

  var user = users[0];
  var account = nk.accountGetId(user.userId);

  if (!account.email) {
    throw Error('This account was not registered with email. Use Quick Play instead.');
  }

  try {
    nk.authenticateEmail(account.email, data.password, data.username, false);
  } catch (e) {
    throw Error('Invalid password');
  }

  var tokenResult = nk.authenticateTokenGenerate(user.userId, data.username);
  logger.info('Username login successful for %s', data.username);

  return JSON.stringify({
    token: tokenResult.token,
    userId: user.userId,
    username: data.username,
  });
};

var rpcFindMatch: nkruntime.RpcFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  var mode: GameMode = 'classic';

  if (payload) {
    try {
      var data = JSON.parse(payload);
      if (data.mode === 'timed') {
        mode = 'timed';
      }
    } catch (e) {
      logger.error('Failed to parse find_match payload: %s', payload);
    }
  }

  var limit = 10;
  var authoritative = true;
  var query = '+label.open:1 +label.mode:' + mode;

  var matches = nk.matchList(limit, authoritative, null, null, null, query);

  var results: any[] = [];
  for (var i = 0; i < matches.length; i++) {
    var m = matches[i];
    results.push({
      matchId: m.matchId,
      playerCount: m.size,
      label: m.label ? JSON.parse(m.label) : null,
    });
  }

  logger.info('RPC find_match: found %d open matches for mode %s', results.length, mode);

  return JSON.stringify({ matches: results });
};
