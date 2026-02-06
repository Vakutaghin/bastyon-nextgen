export const rpcEndpoints = {
  // User methods
  getUserProfile: '/rpc/getuserprofile',
  getUserState: '/rpc/getuserstate',
  getUserStatistic: '/rpc/getuserstatistic',
  
  // Node methods
  getNodeInfo: '/rpc/getnodeinfo',
  
  // Content methods
  getTopFeed: '/rpc-ex/gettopfeed',
  getBoostFeed: '/rpc-ex/getboostfeed',
  getHierarchicalStrip: '/rpc-ex/gethierarchicalstrip',
  getProfileFeed: '/rpc-ex/getprofilefeed',
  
  // Comment methods
  getComments: '/rpc/getcomments',
  getLastComments: '/rpc/getlastcomments',
  getPageScores: '/rpc/getpagescores',
  
  // Account methods
  getAccountSetting: '/rpc/getaccountsetting',
  getAccountEarning: '/rpc/getaccountearning',
  
  // Statistics methods
  getContentsStatistic: '/rpc/getcontentsstatistic',
  
  // Other methods
  getMissedInfo: '/rpc/getmissedinfo',
  getApps: '/rpc/getapps',
  getRawTransactionWithMessageById: '/rpc/getrawtransactionwithmessagebyid',
}
