var InitModule: nkruntime.InitModule = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  initializer: nkruntime.Initializer
) {
  initializer.registerMatch('tic-tac-toe', {
    matchInit,
    matchJoinAttempt,
    matchJoin,
    matchLeave,
    matchLoop,
    matchTerminate,
    matchSignal,
  });

  initializer.registerMatchmakerMatched(matchmakerMatched);

  initializer.registerRpc('login_with_username', rpcLoginWithUsername);
  initializer.registerRpc('create_match', rpcCreateMatch);
  initializer.registerRpc('find_match', rpcFindMatch);
  initializer.registerRpc('get_leaderboard', rpcGetLeaderboard);
  initializer.registerRpc('get_player_stats', rpcGetPlayerStats);

  initLeaderboard(nk, logger);

  initializer.registerAfterAuthenticateDevice(afterAuthenticateDeviceHook);
  initializer.registerAfterAuthenticateEmail(afterAuthenticateEmailHook);

  logger.info('Tic-Tac-Toe module loaded.');
};
