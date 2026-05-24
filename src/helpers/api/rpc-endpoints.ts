export const rpcEndpoints = {
  // User methods
  getUserProfile: 'getuserprofile',
  getUserState: 'getuserstate',
  getUserStatistic: 'getuserstatistic',
  getUserAddress: 'getuseraddress',
  searchUsers: 'searchusers',

  // Node methods
  getNodeInfo: 'getnodeinfo',

  // Content / Feed methods (rpc-ex)
  getTopFeed: 'gettopfeed',
  getBoostFeed: 'getboostfeed',
  getHierarchicalStrip: 'gethierarchicalstrip',
  getProfileFeed: 'getprofilefeed',
  getSubscribesFeed: 'getsubscribesfeed',
  getMostCommentedFeed: 'getmostcommentedfeed',

  // Comment methods
  getComments: 'getcomments',
  getLastComments: 'getlastcomments',
  getPageScores: 'getpagescores',

  // Tags / Categories
  getTags: 'gettags',

  // Account methods
  getAccountSetting: 'getaccountsetting',
  getAccountEarning: 'getaccountearning',

  // Statistics methods
  getContentsStatistic: 'getcontentsstatistic',

  // Transaction / Blockchain methods
  txUnspent: 'txunspent',
  getRawTransaction: 'getrawtransaction',
  getRawTransactionWithMessageById: 'getrawtransactionwithmessagebyid',
  sendRawTransactionWithMessage: 'sendrawtransactionwithmessage',

  // Block Explorer methods
  getCoinInfo: 'getcoininfo',
  getLastBlocks: 'getlastblocks',
  getCompactBlock: 'getcompactblock',
  getBlockTransactions: 'getblocktransactions',
  getTransactions: 'gettransactions',
  getAddressInfo: 'getaddressinfo',
  getAddressTransactions: 'getaddresstransactions',
  searchByHash: 'searchbyhash',
  getPeerInfo: 'getpeerinfo',
  getStatisticByHours: 'getstatisticbyhours',
  getStatisticByDays: 'getstatisticbydays',
  getStatisticContentByHours: 'getstatisticcontentbyhours',
  getStatisticContentByDays: 'getstatisticcontentbydays',

  // Other methods
  getMissedInfo: 'getmissedinfo',
  getApps: 'getapps',
} as const

/** Методы, которые идут через /rpc-ex/ (ленты и т.п.). */
const RPC_EX_METHODS = new Set<string>([
  rpcEndpoints.getTopFeed,
  rpcEndpoints.getBoostFeed,
  rpcEndpoints.getHierarchicalStrip,
  rpcEndpoints.getProfileFeed,
  rpcEndpoints.getSubscribesFeed,
  rpcEndpoints.getMostCommentedFeed,
])

/**
 * Возвращает путь RPC-эндпоинта по имени метода.
 * Если метод не из rpcEndpoints, использует useEx для выбора префикса (fallback).
 */
export function getRpcPath(method: string, useEx = false): string {
  const prefix = RPC_EX_METHODS.has(method) || useEx ? 'rpc-ex' : 'rpc'
  return `/${prefix}/${method}`
}
