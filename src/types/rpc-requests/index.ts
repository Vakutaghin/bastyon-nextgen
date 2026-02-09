/**
 * Экспорт всех типов RPC запросов
 *
 * Этот файл экспортирует все типы запросов для удобного импорта.
 *
 * **Пример использования:**
 * ```typescript
 * import type { GetUserProfileRequest, GetTopFeedRequest } from '@/types/rpc-requests'
 * ```
 */

// Общие типы
export type { BaseRpcRequest, RpcRequestOptions } from './common'

// User methods
export type { GetUserProfileRequest, GetUserProfileParameters } from './user-get'
export type { GetUserStateRequest, GetUserStateParameters } from './user-state'

// Node methods
export type { GetNodeInfoRequest, GetNodeInfoParameters } from './get-node-info'

// Content methods
export type { GetTopFeedRequest, GetTopFeedParameters } from './get-top-feed'
export type { GetProfileFeedRequest, GetProfileFeedParameters } from './get-profile-feed'
export type { GetHierarchicalStripRequest, GetHierarchicalStripParameters } from './get-hierarchical-strip'

// Comment methods
export type { GetCommentsRequest, GetCommentsParameters } from './get-comments'
export type { GetLastCommentsRequest, GetLastCommentsParameters } from './get-last-comments'
export type { GetPageScoresRequest, GetPageScoresParameters } from './get-page-scores'
export type {
  SendRawTransactionWithMessageRequest,
  SendRawTransactionWithMessageParameters,
  CommentMessagePayload,
  CommentMessageBody,
  SendRawTransactionOperationType
} from './send-raw-transaction-with-message'

// Account methods
export type { GetAccountSettingRequest, GetAccountSettingParameters } from './get-account-setting'
export type { GetAccountEarningRequest, GetAccountEarningParameters } from './get-account-earning'

// Statistics methods
export type { GetContentsStatisticRequest, GetContentsStatisticParameters } from './get-contents-statistic'
export type { GetUserStatisticRequest, GetUserStatisticParameters } from './get-user-statistic'

// Other methods
export type { GetMissedInfoRequest, GetMissedInfoParameters } from './get-missed-info'
export type { GetAppsRequest, GetAppsParameters } from './get-apps'
export type { GetTagsRequest, GetTagsParameters } from './get-tags'
