/**
 * UI-строки блок-эксплорера.
 *
 * Все строки UI (ru) собраны здесь в одном файле, чтобы при добавлении общего
 * i18n-движка по проекту (см. TODO #33) экстракт можно было сделать одним
 * проходом. Технический словарь терминов лежит отдельно — в `components/shared/
 * explorer-glossary.ts` — он тоже i18n-friendly и не пересекается с этим
 * файлом.
 *
 * Структура — namespace по доменам (common, search, main, block, tx, address,
 * peers, topAddresses, stats). Параметризованные строки — функции, всё
 * остальное — строковые литералы.
 */

export const explorerStrings = {
  common: {
    breadcrumbRoot: 'Эксплорер',
    live: 'live',
    offline: 'offline',
    liveTooltipOn: 'Real-time через WebSocket',
    liveTooltipOff: 'Соединение восстанавливается',
    rawJsonShow: 'Показать сырой JSON',
    rawJsonHide: 'Скрыть сырой JSON',
    loadMore: 'Загрузить ещё',
    loading: 'Загрузка…',
    ellipsis: '…',
    em: '—',
  },

  search: {
    placeholder: 'Хеш блока, txid, адрес или высота',
    submit: 'Открыть',
    submitting: 'Поиск…',
    hintBlock: 'Блок',
    hintAddress: 'Адрес',
    hintHash: 'Хеш',
    suggestionsTitle: 'Недавно открытые',
    suggestionsKindBlock: 'Блок',
    suggestionsKindTx: 'TX',
    suggestionsKindAddress: 'Адрес',
    clearAll: 'Очистить',
    removeFromHistory: 'Убрать из истории',
    errorUnknown: 'Не удалось определить тип строки. Проверьте формат.',
    errorNetwork: 'Ошибка сетевого поиска',
  },

  main: {
    title: 'Блок-эксплорер Pocketnet',
    /** «Сеть main · последний блок #123 · обновлено 2 мин назад». */
    subtitle: (chain: string, height: string, age: string) =>
      `Сеть ${chain} · последний блок ${height} · обновлено ${age}`,
    chainMain: 'main',
    chainTest: 'testnet',
    chainUnknown: 'unknown',
    statHeight: 'Высота',
    statHeightHint: 'Последний блок сети',
    statEmission: 'Эмиссия',
    statEmissionHint: 'PKOIN в обращении',
    statNodeVersion: 'Версия ноды',
    statNetStakeWeight: 'Net stake weight',
    statNetStakeWeightHint: 'Чем больше, тем безопаснее сеть',
    sectionLatestBlocks: 'Последние блоки',
    sectionNetworkInfo: 'Информация о сети',
    linkPeers: 'Все ноды и пиры →',
    tip: 'Tip',
    /** «3 tx» / «12 tx». */
    txCount: (n: number) => `${n} tx`,
    serverNoteFallback: 'pocketnet.app',
    /** Подсказка о децентрализации в правом блоке главной. */
    decentralizationNote: (server: string) =>
      `Эксплорер использует тот же набор нод, что и остальное приложение (${server}). Никаких внешних редиректов на www.bastyon.com.`,
    errorLoadBlocks: 'Не удалось загрузить блоки',
    errorNodeUnavailable: 'Нода недоступна',
  },

  block: {
    breadcrumb: 'Блок',
    shareTitle: (height: string) => `Блок ${height}`,
    navPrev: 'Предыдущий',
    navNext: 'Следующий',
    metaHash: 'Хеш блока',
    metaHeight: 'Высота',
    metaTime: 'Время',
    metaNTx: 'Транзакций',
    metaConfirmations: 'Подтверждений',
    metaConfirmationsTip: '· tip',
    metaDifficulty: 'Сложность · bits',
    metaStaker: 'Стейкер',
    metaStakerPos: 'Стейкер (PoS)',
    metaMinerPow: 'Майнер (PoW)',
    metaReward: 'Награда блока',
    metaMerkle: 'Merkle root',
    metaSiblings: 'Соседи',
    sectionTxTitle: 'Транзакции в блоке',
    /** «Показано 50 из 200». */
    txPager: (shown: number, total: number) =>
      total > 0 ? `Показано ${shown} из ${total}` : '',
    /** «Загрузить ещё (50)». */
    loadMoreNext: (next: number) => (next > 0 ? `Загрузить ещё (${next})` : 'Загрузить ещё'),
    txEmpty: 'Транзакций нет',
    txError: 'Не удалось загрузить транзакции',
    notFound:
      'Блок не найден. Возможно, это txid — попробуйте открыть как транзакцию.',
    errorPrefix: (msg: string) => `Ошибка загрузки блока: ${msg}`,
  },

  tx: {
    breadcrumb: 'Транзакция',
    title: 'Транзакция',
    shareTitle: (txid: string) => `Транзакция ${txid}`,
    metaTxid: 'TX ID',
    metaType: 'Тип',
    metaBlock: 'Блок',
    metaConfirmationsTime: 'Подтверждений · время',
    metaVin: 'Входов',
    metaVout: 'Выходов',
    metaFee: 'Комиссия',
    metaFeeUnknown: 'не определена',
    metaPocketnet: 'Pocketnet',
    metaPocketnetCardHint: 'см. карточку ниже',
    metaPocketnetEmpty: 'не социальная транзакция',
    ioHeaderVin: 'Входы (vin)',
    ioHeaderVout: 'Выходы (vout)',
    ioCoinbase: 'Coinbase',
    ioOpReturn: 'OP_RETURN (data)',
    /** «от a1b2c3…:0». */
    ioVinFrom: 'от',
    payloadKindLabels: {
      post: 'контент',
      comment: 'комментарий',
      'comment-edit': 'редакция комментария',
      'upvote-share': 'оценка поста',
      'c-score': 'оценка комментария',
      subscribe: 'подписка',
      'block-user': 'блокировка',
      boost: 'буст',
      account: 'действие с аккаунтом',
    } as Record<string, string>,
    notFound: 'Транзакция не найдена',
    errorPrefix: (msg: string) => `Не удалось загрузить транзакцию: ${msg}`,
  },

  address: {
    breadcrumb: 'Адрес',
    shareTitle: (address: string) => `Адрес ${address}`,
    summaryBalance: 'Баланс',
    summaryLastChange: 'Последняя активность',
    summaryProfileLink: 'Связь с приложением',
    openProfile: 'Открыть профиль',
    /** «блок #123 456». */
    lastChangeAtBlock: (heightLabel: string) => `блок #${heightLabel}`,
    sectionTx: 'Транзакции',
    txEmpty: 'Транзакций нет',
    txError: 'Не удалось загрузить транзакции',
  },

  peers: {
    breadcrumb: 'Сеть',
    title: 'Ноды и пиры сети',
    nodesSectionTitle: 'Публичные ноды Pocketnet',
    /** «5/6 живы · ping каждые 60 с». */
    nodesHealthHint: (alive: number, total: number) =>
      `${alive}/${total} живы · ping каждые 60 с`,
    nodeOk: 'доступна',
    nodeFail: 'недоступна',
    nodeMetricPing: 'Ping',
    nodeMetricHeight: 'Высота',
    nodeMetricVersion: 'Версия',
    peersSectionTitle: 'Пиры подключенной ноды',
    /** «42 пиров · 5 входящих». */
    peersCountHint: (total: number, inbound: number) =>
      `${total} пиров · ${inbound} входящих`,
    colAddress: 'Адрес',
    colClient: 'Клиент',
    colDirection: 'Тип',
    colPing: 'Ping',
    colSync: 'Sync',
    colConnected: 'Подключён',
    dirIn: 'входящий',
    dirOut: 'исходящий',
    peersEmpty: 'Пиров не найдено',
    peersError: 'Не удалось загрузить пиры',
  },

  topAddresses: {
    title: 'Активные адреса',
    tooltip:
      'Топ адресов по числу транзакций за последние блоки. Считается локально по данным ноды — без зависимости от центрального хоста.',
    collapse: 'Свернуть',
    /** «Показать топ-30». */
    expand: (n: number) => `Показать топ-${n}`,
    /** «За последние 50 блоков · 1 234 tx». */
    hint: (blocks: number, txCount: number) =>
      `За последние ${blocks} блоков · ${txCount.toLocaleString('en-US')} tx`,
    error: 'Не удалось вычислить топ адресов',
    empty: 'Нет активности',
    volumeTooltip: 'Получено + отправлено за окно',
    countTooltip: 'Появлений в транзакциях',
    /** «3 tx». */
    txCount: (n: number) => `${n} tx`,
  },

  stats: {
    title: 'Активность сети',
    toggleHours: '48 часов',
    toggleDays: '30 дней',
    /** «Всего 12 345 транзакций за 48 ч». */
    subtitle: (total: number, n: number, granularity: 'hours' | 'days') => {
      const unit = granularity === 'hours' ? `${n} ч` : `${n} д`
      return `Всего ${total.toLocaleString('en-US')} транзакций за ${unit}`
    },
    error: 'Не удалось загрузить статистику',
    empty: 'Нет данных',
    legend: {
      content: 'Контент (пост/коммент)',
      ratings: 'Оценки',
      subscriptions: 'Подписки',
      accounts: 'Аккаунты',
      moderation: 'Модерация',
      other: 'Прочее (PoS/переводы)',
    },
    /** «-5ч» / «-12д» / «сейчас». */
    xTickNow: 'сейчас',
    xTick: (fromEnd: number, granularity: 'hours' | 'days') =>
      `-${fromEnd}${granularity === 'hours' ? 'ч' : 'д'}`,
  },
} as const

export type ExplorerStrings = typeof explorerStrings
