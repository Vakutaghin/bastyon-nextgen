/**
 * UI-строки блок-эксплорера.
 *
 * Значения берутся из i18n-домена `bex` (см. словари src/locales/*). Публичный
 * API `explorerStrings` сохранён без изменений: потребители продолжают читать
 * `s.common.live`, вызывать `s.main.subtitle(...)` и т.п.
 *
 * Важно про реактивность: плоские строки реализованы как ГЕТТЕРЫ, иначе
 * значение захватилось бы один раз при инициализации модуля и не отреагировало
 * бы на смену локали. Параметризованные строки — функции, вызывающие t() при
 * каждом обращении.
 *
 * Структура — namespace по доменам (common, search, main, block, tx, address,
 * peers, topAddresses, stats).
 */

import { t } from '@/i18n'

export const explorerStrings = {
  common: {
    get breadcrumbRoot() {
      return t('bex.common.breadcrumbRoot')
    },
    get live() {
      return t('bex.common.live')
    },
    get offline() {
      return t('bex.common.offline')
    },
    get liveTooltipOn() {
      return t('bex.common.liveTooltipOn')
    },
    get liveTooltipOff() {
      return t('bex.common.liveTooltipOff')
    },
    get rawJsonShow() {
      return t('bex.common.rawJsonShow')
    },
    get rawJsonHide() {
      return t('bex.common.rawJsonHide')
    },
    get loadMore() {
      return t('bex.common.loadMore')
    },
    get loading() {
      return t('bex.common.loading')
    },
    get ellipsis() {
      return t('bex.common.ellipsis')
    },
    get em() {
      return t('bex.common.em')
    },
  },

  search: {
    get placeholder() {
      return t('bex.search.placeholder')
    },
    get submit() {
      return t('bex.search.submit')
    },
    get submitting() {
      return t('bex.search.submitting')
    },
    get hintBlock() {
      return t('bex.search.hintBlock')
    },
    get hintAddress() {
      return t('bex.search.hintAddress')
    },
    get hintHash() {
      return t('bex.search.hintHash')
    },
    get suggestionsTitle() {
      return t('bex.search.suggestionsTitle')
    },
    get suggestionsKindBlock() {
      return t('bex.search.suggestionsKindBlock')
    },
    get suggestionsKindTx() {
      return t('bex.search.suggestionsKindTx')
    },
    get suggestionsKindAddress() {
      return t('bex.search.suggestionsKindAddress')
    },
    get clearAll() {
      return t('bex.search.clearAll')
    },
    get removeFromHistory() {
      return t('bex.search.removeFromHistory')
    },
    get errorUnknown() {
      return t('bex.search.errorUnknown')
    },
    get errorNetwork() {
      return t('bex.search.errorNetwork')
    },
  },

  main: {
    get title() {
      return t('bex.main.title')
    },
    /** «Сеть main · последний блок #123 · обновлено 2 мин назад». */
    subtitle: (chain: string, height: string, age: string) =>
      t('bex.main.subtitle', { chain, height, age }),
    get chainMain() {
      return t('bex.main.chainMain')
    },
    get chainTest() {
      return t('bex.main.chainTest')
    },
    get chainUnknown() {
      return t('bex.main.chainUnknown')
    },
    get statHeight() {
      return t('bex.main.statHeight')
    },
    get statHeightHint() {
      return t('bex.main.statHeightHint')
    },
    get statEmission() {
      return t('bex.main.statEmission')
    },
    get statEmissionHint() {
      return t('bex.main.statEmissionHint')
    },
    get statNodeVersion() {
      return t('bex.main.statNodeVersion')
    },
    get statNetStakeWeight() {
      return t('bex.main.statNetStakeWeight')
    },
    get statNetStakeWeightHint() {
      return t('bex.main.statNetStakeWeightHint')
    },
    get sectionLatestBlocks() {
      return t('bex.main.sectionLatestBlocks')
    },
    get sectionNetworkInfo() {
      return t('bex.main.sectionNetworkInfo')
    },
    get linkPeers() {
      return t('bex.main.linkPeers')
    },
    get tip() {
      return t('bex.main.tip')
    },
    /** «3 tx» / «12 tx». */
    txCount: (n: number) => t('bex.main.txCount', { n }),
    get serverNoteFallback() {
      return t('bex.main.serverNoteFallback')
    },
    /** Подсказка о децентрализации в правом блоке главной. */
    decentralizationNote: (server: string) => t('bex.main.decentralizationNote', { server }),
    get errorLoadBlocks() {
      return t('bex.main.errorLoadBlocks')
    },
    get errorNodeUnavailable() {
      return t('bex.main.errorNodeUnavailable')
    },
  },

  block: {
    get breadcrumb() {
      return t('bex.block.breadcrumb')
    },
    shareTitle: (height: string) => t('bex.block.shareTitle', { height }),
    get navPrev() {
      return t('bex.block.navPrev')
    },
    get navNext() {
      return t('bex.block.navNext')
    },
    get metaHash() {
      return t('bex.block.metaHash')
    },
    get metaHeight() {
      return t('bex.block.metaHeight')
    },
    get metaTime() {
      return t('bex.block.metaTime')
    },
    get metaNTx() {
      return t('bex.block.metaNTx')
    },
    get metaConfirmations() {
      return t('bex.block.metaConfirmations')
    },
    get metaConfirmationsTip() {
      return t('bex.block.metaConfirmationsTip')
    },
    get metaDifficulty() {
      return t('bex.block.metaDifficulty')
    },
    get metaStaker() {
      return t('bex.block.metaStaker')
    },
    get metaStakerPos() {
      return t('bex.block.metaStakerPos')
    },
    get metaMinerPow() {
      return t('bex.block.metaMinerPow')
    },
    get metaReward() {
      return t('bex.block.metaReward')
    },
    get metaMerkle() {
      return t('bex.block.metaMerkle')
    },
    get metaSiblings() {
      return t('bex.block.metaSiblings')
    },
    get sectionTxTitle() {
      return t('bex.block.sectionTxTitle')
    },
    /** «Показано 50 из 200». */
    txPager: (shown: number, total: number) =>
      total > 0 ? t('bex.block.txPager', { shown, total }) : '',
    /** «Загрузить ещё (50)». */
    loadMoreNext: (next: number) =>
      next > 0 ? t('bex.block.loadMoreNext', { next }) : t('bex.common.loadMore'),
    get txEmpty() {
      return t('bex.block.txEmpty')
    },
    get txError() {
      return t('bex.block.txError')
    },
    get notFound() {
      return t('bex.block.notFound')
    },
    errorPrefix: (msg: string) => t('bex.block.errorPrefix', { msg }),
  },

  tx: {
    get breadcrumb() {
      return t('bex.tx.breadcrumb')
    },
    get title() {
      return t('bex.tx.title')
    },
    shareTitle: (txid: string) => t('bex.tx.shareTitle', { txid }),
    get metaTxid() {
      return t('bex.tx.metaTxid')
    },
    get metaType() {
      return t('bex.tx.metaType')
    },
    get metaBlock() {
      return t('bex.tx.metaBlock')
    },
    get metaConfirmationsTime() {
      return t('bex.tx.metaConfirmationsTime')
    },
    get metaVin() {
      return t('bex.tx.metaVin')
    },
    get metaVout() {
      return t('bex.tx.metaVout')
    },
    get metaFee() {
      return t('bex.tx.metaFee')
    },
    get metaFeeUnknown() {
      return t('bex.tx.metaFeeUnknown')
    },
    get metaPocketnet() {
      return t('bex.tx.metaPocketnet')
    },
    get metaPocketnetCardHint() {
      return t('bex.tx.metaPocketnetCardHint')
    },
    get metaPocketnetEmpty() {
      return t('bex.tx.metaPocketnetEmpty')
    },
    get ioHeaderVin() {
      return t('bex.tx.ioHeaderVin')
    },
    get ioHeaderVout() {
      return t('bex.tx.ioHeaderVout')
    },
    get ioCoinbase() {
      return t('bex.tx.ioCoinbase')
    },
    get ioOpReturn() {
      return t('bex.tx.ioOpReturn')
    },
    /** «от a1b2c3…:0». */
    get ioVinFrom() {
      return t('bex.tx.ioVinFrom')
    },
    /**
     * Метки типов социальных payload-ов. Индексируемый словарь (потребитель
     * читает по ключу: `payloadKindLabels[k]`), поэтому это геттер, отдающий
     * объект со свежими переводами при каждом обращении.
     */
    get payloadKindLabels(): Record<string, string> {
      return {
        post: t('bex.tx.payloadKindLabels.post'),
        comment: t('bex.tx.payloadKindLabels.comment'),
        'comment-edit': t('bex.tx.payloadKindLabels.comment-edit'),
        'upvote-share': t('bex.tx.payloadKindLabels.upvote-share'),
        'c-score': t('bex.tx.payloadKindLabels.c-score'),
        subscribe: t('bex.tx.payloadKindLabels.subscribe'),
        'block-user': t('bex.tx.payloadKindLabels.block-user'),
        boost: t('bex.tx.payloadKindLabels.boost'),
        account: t('bex.tx.payloadKindLabels.account'),
      }
    },
    get notFound() {
      return t('bex.tx.notFound')
    },
    errorPrefix: (msg: string) => t('bex.tx.errorPrefix', { msg }),
  },

  address: {
    get breadcrumb() {
      return t('bex.address.breadcrumb')
    },
    shareTitle: (address: string) => t('bex.address.shareTitle', { address }),
    get summaryBalance() {
      return t('bex.address.summaryBalance')
    },
    get summaryLastChange() {
      return t('bex.address.summaryLastChange')
    },
    get summaryProfileLink() {
      return t('bex.address.summaryProfileLink')
    },
    get openProfile() {
      return t('bex.address.openProfile')
    },
    /** «блок #123 456». */
    lastChangeAtBlock: (heightLabel: string) => t('bex.address.lastChangeAtBlock', { heightLabel }),
    get sectionTx() {
      return t('bex.address.sectionTx')
    },
    get txEmpty() {
      return t('bex.address.txEmpty')
    },
    get txError() {
      return t('bex.address.txError')
    },
  },

  peers: {
    get breadcrumb() {
      return t('bex.peers.breadcrumb')
    },
    get title() {
      return t('bex.peers.title')
    },
    get nodesSectionTitle() {
      return t('bex.peers.nodesSectionTitle')
    },
    /** «5/6 живы · ping каждые 60 с». */
    nodesHealthHint: (alive: number, total: number) =>
      t('bex.peers.nodesHealthHint', { alive, total }),
    get nodeOk() {
      return t('bex.peers.nodeOk')
    },
    get nodeFail() {
      return t('bex.peers.nodeFail')
    },
    get nodeMetricPing() {
      return t('bex.peers.nodeMetricPing')
    },
    get nodeMetricHeight() {
      return t('bex.peers.nodeMetricHeight')
    },
    get nodeMetricVersion() {
      return t('bex.peers.nodeMetricVersion')
    },
    get peersSectionTitle() {
      return t('bex.peers.peersSectionTitle')
    },
    /** «42 пиров · 5 входящих». */
    peersCountHint: (total: number, inbound: number) =>
      t('bex.peers.peersCountHint', { total, inbound }),
    get colAddress() {
      return t('bex.peers.colAddress')
    },
    get colClient() {
      return t('bex.peers.colClient')
    },
    get colDirection() {
      return t('bex.peers.colDirection')
    },
    get colPing() {
      return t('bex.peers.colPing')
    },
    get colSync() {
      return t('bex.peers.colSync')
    },
    get colConnected() {
      return t('bex.peers.colConnected')
    },
    get dirIn() {
      return t('bex.peers.dirIn')
    },
    get dirOut() {
      return t('bex.peers.dirOut')
    },
    get peersEmpty() {
      return t('bex.peers.peersEmpty')
    },
    get peersError() {
      return t('bex.peers.peersError')
    },
  },

  topAddresses: {
    get title() {
      return t('bex.topAddresses.title')
    },
    get tooltip() {
      return t('bex.topAddresses.tooltip')
    },
    get collapse() {
      return t('bex.topAddresses.collapse')
    },
    /** «Показать топ-30». */
    expand: (n: number) => t('bex.topAddresses.expand', { n }),
    /** «За последние 50 блоков · 1 234 tx». */
    hint: (blocks: number, txCount: number) =>
      t('bex.topAddresses.hint', { blocks, txCount: txCount.toLocaleString('en-US') }),
    get error() {
      return t('bex.topAddresses.error')
    },
    get empty() {
      return t('bex.topAddresses.empty')
    },
    get volumeTooltip() {
      return t('bex.topAddresses.volumeTooltip')
    },
    get countTooltip() {
      return t('bex.topAddresses.countTooltip')
    },
    /** «3 tx». */
    txCount: (n: number) => t('bex.topAddresses.txCount', { n }),
  },

  stats: {
    get title() {
      return t('bex.stats.title')
    },
    get toggleHours() {
      return t('bex.stats.toggleHours')
    },
    get toggleDays() {
      return t('bex.stats.toggleDays')
    },
    /** «Всего 12 345 транзакций за 48 ч». */
    subtitle: (total: number, n: number, granularity: 'hours' | 'days') => {
      const unit = granularity === 'hours' ? t('bex.stats.unitHours', { n }) : t('bex.stats.unitDays', { n })
      return t('bex.stats.subtitle', { total: total.toLocaleString('en-US'), unit })
    },
    get error() {
      return t('bex.stats.error')
    },
    get empty() {
      return t('bex.stats.empty')
    },
    legend: {
      get content() {
        return t('bex.stats.legend.content')
      },
      get ratings() {
        return t('bex.stats.legend.ratings')
      },
      get subscriptions() {
        return t('bex.stats.legend.subscriptions')
      },
      get accounts() {
        return t('bex.stats.legend.accounts')
      },
      get moderation() {
        return t('bex.stats.legend.moderation')
      },
      get other() {
        return t('bex.stats.legend.other')
      },
    },
    /** «-5ч» / «-12д» / «сейчас». */
    get xTickNow() {
      return t('bex.stats.xTickNow')
    },
    xTick: (fromEnd: number, granularity: 'hours' | 'days') =>
      granularity === 'hours'
        ? t('bex.stats.xTickHours', { fromEnd })
        : t('bex.stats.xTickDays', { fromEnd }),
  },
}

export type ExplorerStrings = typeof explorerStrings
