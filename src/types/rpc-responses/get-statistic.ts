import type { BaseRpcResponse, StandardRpcTime } from './common'

/**
 * Один бакет статистики: ключ — код типа транзакции (как строка "200"/"300"…),
 * значение — число tx этого типа в бакете.
 */
export type StatisticBucket = Record<string, number>

/**
 * Сводка статистики по времени: ключ — порядковый номер бакета (час или день
 * от некоторой нодовой точки отсчёта; конкретное значение epoch неважно — нас
 * интересует относительный порядок), значение — bucket-разбивка.
 *
 * Используется и для getstatisticbyhours/getstatisticbydays, и для контентных
 * вариантов (getstatisticcontentby*).
 */
export type StatisticBuckets = Record<string, StatisticBucket>

export type GetStatisticResponse = BaseRpcResponse<StatisticBuckets, StandardRpcTime>
