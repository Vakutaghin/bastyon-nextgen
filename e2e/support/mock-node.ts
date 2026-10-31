import type { Page, Route } from '@playwright/test'

/**
 * Подменная нода Pocketnet для e2e: отвечает на `/ping` и RPC
 * (`/rpc/<метод>`, `/rpc-ex/<метод>`) у всех `*.pocketnet.app:8899`
 * синтетическими данными той же формы, что у настоящей ноды (сверено с её
 * ответами 28.09.2026). Остальной внешний трафик (картинки, Matrix, PeerTube)
 * обрывается — тесты не зависят от сети и ничего не публикуют.
 *
 * Неизвестный метод получает пустой успешный ответ: экран, которому он не
 * нужен, не должен из-за него падать.
 */

export interface MockProfile {
  address: string
  name: string
  reputation?: number
  /** Открытые ключи мессенджера через запятую — без них чат не шифрует. */
  k?: string
  /** Отметки ноды: `moderator`, `shark`. */
  badges?: string[]
  /** Кого он заблокировал (`blocking` полного профиля). */
  blocking?: string[]
  /** Подписчики (`getusersubscribers`). */
  subscribers?: string[]
  /** Адреса для пожертвований (`b`). */
  donations?: Array<{ currency: string; address: string }>
  /** «О себе» (`a`) и сайт (`s`). */
  about?: string
  site?: string
}

export interface MockPost {
  txid: string
  address: string
  message: string
  /** Тип поста у ноды: `share` (по умолчанию), `video`, `article`… */
  type?: string
  /** Ссылка поста (`u`), у видео — `peertube://хост/id`. */
  url?: string
  tags?: string[]
  caption?: string
  settings?: Record<string, unknown>
  comments?: number
  /** Картинки поста (`i`). */
  images?: string[]
  /** Сколько секунд назад опубликован; по умолчанию — по порядку в списке, через 10 минут. */
  ago?: number
  /** id комментария, который нода покажет превью под постом (`lastComment`). */
  lastComment?: string
  /** Только по txid (getrawtransactionwithmessagebyid): в общих лентах его нет — как продвигаемый пост. */
  byIdOnly?: boolean
  /**
   * Язык поста (`l`). С ним лента с языком в запросе отбирает пост, как нода;
   * без него — пост русский и виден на любом языке ленты.
   */
  language?: string
}

export interface MockComment {
  id: string
  postid: string
  address: string
  message: string
  /** Номер варианта опроса: такой комментарий — голос (helpers/content/poll.ts). */
  pollVote?: { index: number; option: string }
  /** Автор поста заблокировал комментатора: нода ставит `blck_cnt_cmt: 1`. */
  blockedByPostAuthor?: boolean
  /** Лайков у комментария; по умолчанию 0. */
  scoreUp?: number
  /** Ответ в ветке: корневой комментарий ветки. */
  parentid?: string
  /** Ответ в ветке: комментарий, которому он адресован. */
  answerid?: string
}

/** Коллекция или плейлист (транзакция 220). */
export interface MockCollection {
  txid: string
  address: string
  caption: string
  contentIds: string[]
  /** 201 — видеоплейлист, 210 — аудио; без поля — как у старого клиента. */
  contentTypes?: number
  image?: string
  description?: string
}

export interface MockNodeData {
  profiles: MockProfile[]
  /** Коллекции: `getprofilecollections` и `getrawtransactionwithmessagebyid`. */
  collections?: MockCollection[]
  posts: MockPost[]
  comments: MockComment[]
  /** На кого подписан вошедший (`getusersubscribes`). */
  subscribes?: string[]
  /** Превью ссылок (`urlPreview`): адрес → OG-теги страницы; без записи — превью нет. */
  linkPreviews?: Record<
    string,
    { title?: string; description?: string; site_name?: string; image?: string }
  >
  /** Настройки аккаунтов (`getaccountsetting`): обложка, цена подписки… */
  settings?: Record<string, Record<string, unknown>>
  /** Облако популярных тегов (`gettags`): подсказки тегов в форме поста. */
  tags?: string[]
  /** Лента бустов (`getboostfeed`): txid поста и сумма буста в сатоши. */
  boosts?: { txid: string; boost: number }[]
  /** Сеть нод для вкладки «Сеть» «Блокчейн-обозревателя». */
  network?: MockNetwork
}

/** Сеть нод: кто с кем соединён и кто в пуле прокси. */
export interface MockNetwork {
  /** Соседи ноды по её адресу: `ip:порт`, inbound — подключилась к ней сама. */
  peers: Record<
    string,
    Array<{ addr: string; inbound?: boolean; version?: string; services?: string }>
  >
  /** Ноды пула прокси — с них начинается обход. */
  pool: string[]
  /** Приложений онлайн на прокси. */
  clients?: number
}

/** Ответы прокси о сети (`/info`) и нод о себе и соседях (`options.node`). */
function networkAnswer(
  network: MockNetwork,
  path: string,
  method: string,
  node: string | undefined
): { data: unknown; node?: string } | null {
  if (path === '/info') {
    const nodes = Object.fromEntries(
      network.pool.map((ip) => [
        `${ip}:38081`,
        {
          node: { version: '0.22.21' },
          users: 3,
          statistic: { percent: 99, time: 120 },
          status: { fork: false, difference: 0 },
        },
      ])
    )
    return {
      data: {
        info: {
          nodeManager: { count: network.pool.length, nodes },
          wss: { clients: network.clients ?? 0, users: Math.round((network.clients ?? 0) / 2) },
          server: { startedDate: '2026-10-29T00:00:00.000Z', middle: { rate: 1.5 } },
        },
      },
    }
  }
  const target = node ?? `${network.pool[0]}:38081`
  const ip = target.replace(/:\d+$/, '')
  if (method === 'getpeerinfo') {
    const peers = network.peers[ip]
    if (!peers) return null
    return {
      node: target,
      data: peers.map((p) => ({
        addr: p.addr,
        services: p.services ?? '0000000000000409',
        relaytxes: true,
        lastsend: NOW,
        lastrecv: NOW,
        conntime: NOW - 86_400,
        timeoffset: 0,
        pingtime: 0.04,
        protocol: 70016,
        version: `/Satoshi:${p.version ?? '0.22.21'}/`,
        inbound: !!p.inbound,
        whitelisted: false,
        banscore: 0,
        startingheight: HEIGHT - 100,
        synced_headers: HEIGHT,
        synced_blocks: HEIGHT,
      })),
    }
  }
  if (method === 'getnodeinfo' && node) {
    if (!network.peers[ip]) return null
    return {
      node: target,
      data: { version: '0.22.21', chain: 'main', lastblock: { height: HEIGHT, hash: 'mockhash' } },
    }
  }
  return null
}

const HEIGHT = 4_037_000
const NOW = Math.floor(Date.now() / 1000)

function profileJson(p: MockProfile) {
  return {
    hash: `hash-${p.address}`,
    address: p.address,
    id: 1000 + p.name.length,
    name: p.name,
    i: '',
    b: JSON.stringify(p.donations ?? []),
    r: '',
    postcnt: 3,
    dltdcnt: 0,
    reputation: p.reputation ?? 120,
    subscribes_count: 1,
    subscribers_count: 2,
    blockings_count: p.blocking?.length ?? 0,
    blockers_count: 0,
    likers_count: 5,
    k: p.k ?? '',
    a: p.about ?? '',
    l: 'ru',
    s: p.site ?? '',
    update: NOW - 86_400,
    regdate: NOW - 90 * 86_400,
    flags: {},
    firstFlags: {},
    actions: 10,
    bans: {},
    badges: p.badges ?? [],
    ...(p.blocking ? { blocking: p.blocking } : {}),
  }
}

function postJson(post: MockPost, data: MockNodeData, index: number) {
  const author = data.profiles.find((p) => p.address === post.address)
  return {
    hash: post.txid,
    txid: post.txid,
    id: 37_000_000 + index,
    address: post.address,
    time: NOW - (post.ago ?? 600 * (index + 1)),
    l: post.language ?? 'ru',
    type: post.type ?? 'share',
    c: post.caption ?? '',
    m: post.message,
    u: post.url ?? '',
    t: post.tags ?? ['bastyon'],
    i: post.images ?? [],
    s: { a: '', v: '', videos: [], image: '', f: '0', c: '', t: '0', ...post.settings },
    scoreCnt: 0,
    scoreSum: 0,
    reposted: 0,
    comments: post.comments ?? 0,
    versions: [],
    flags: {},
    lastComment: lastCommentJson(post, data),
    userprofile: author ? profileJson(author) : undefined,
  }
}

/** Превью последнего комментария, как в ленте ноды: без профиля автора. */
function lastCommentJson(post: MockPost, data: MockNodeData) {
  if (!post.lastComment) return null
  const index = (data.comments ?? []).findIndex((c) => c.id === post.lastComment)
  if (index < 0) return null
  const comment: Partial<ReturnType<typeof commentJson>> = commentJson(
    data.comments[index]!,
    index,
    data
  )
  delete comment.userprofile
  return comment
}

function commentJson(c: MockComment, index: number, data: MockNodeData) {
  const body = c.pollVote
    ? {
        message: `🗳 ${c.pollVote.option}`,
        url: '',
        images: [],
        info: JSON.stringify({ poll: c.pollVote.index }),
      }
    : { message: c.message, url: '', images: [], info: '' }
  return {
    id: c.id,
    cid: 37_100_000 + index,
    edit: false,
    deleted: false,
    postid: c.postid,
    address: c.address,
    time: NOW - 300 + index,
    timeUpd: NOW - 300 + index,
    block: HEIGHT - 5,
    msg: JSON.stringify(body),
    parentid: c.parentid ?? '',
    answerid: c.answerid ?? '',
    scoreUp: c.scoreUp ?? 0,
    scoreDown: 0,
    children: data.comments.filter((r) => r.parentid === c.id).length,
    flags: {},
    type: 204,
    ...(c.blockedByPostAuthor ? { blck_cnt_cmt: 1 } : {}),
    userprofile: profileOf(c.address, data),
  }
}

function profileOf(address: string, data: MockNodeData) {
  const profile = data.profiles.find((p) => p.address === address)
  return profile ? profileJson(profile) : undefined
}

/** Коллекция в раскладке `getprofilecollections`: элементы строкой JSON, настройки строкой. */
function collectionListJson(c: MockCollection, index: number) {
  return {
    txid: c.txid,
    id: 900 + index,
    contentIds: JSON.stringify(c.contentIds),
    address: c.address,
    l: 'ru',
    type: 'collection',
    c: c.caption,
    i: c.image ?? '',
    s: c.description ? JSON.stringify({ m: c.description }) : '',
    height: HEIGHT - 10,
    ...(c.contentTypes ? { contentTypes: String(c.contentTypes) } : {}),
  }
}

/** Одна коллекция — в раскладке поста, как отдаёт `getrawtransactionwithmessagebyid`. */
function collectionShareJson(c: MockCollection, index: number, data: MockNodeData) {
  return {
    hash: c.txid,
    txid: c.txid,
    id: 900 + index,
    repost: JSON.stringify(c.contentIds),
    address: c.address,
    time: NOW - 3600,
    l: 'ru',
    type: 'collection',
    c: c.caption,
    m: c.image ?? '',
    t: c.description ? { m: c.description } : {},
    versions: [],
    userprofile: profileOf(c.address, data),
  }
}

/** Язык ленты в запросе (4-й параметр) отбирает посты, у которых язык задан. */
function inLanguage(post: MockPost, params: unknown[]): boolean {
  const lang = params[3]
  return !lang || !post.language || post.language === lang
}

function rpcResult(method: string, params: unknown[], data: MockNodeData): unknown {
  switch (method) {
    case 'getprofilecollections': {
      const address = params[10] as string
      return {
        height: HEIGHT,
        contents: (data.collections ?? [])
          .map((c, i) => [c, i] as const)
          .filter(([c]) => c.address === address)
          .map(([c, i]) => collectionListJson(c, i)),
      }
    }
    case 'getprofilefeed': {
      // Лента автора, как у ноды: свежие первыми, страница — после поста `txid`.
      const [, fromTxid, count, , , , , , , , address] = params as [
        unknown,
        string,
        number,
        ...unknown[],
      ]
      const own = data.posts
        .map((p, i) => [p, i] as const)
        .filter(([p]) => inLanguage(p, params))
        .map(([p, i]) => postJson(p, data, i))
        .filter((p) => !address || p.address === address)
        .sort((a, b) => b.time - a.time)
      const start = fromTxid ? own.findIndex((p) => p.txid === fromTxid) + 1 : 0
      return {
        height: HEIGHT,
        contents: own.slice(start, start + (count || own.length)),
        users: [],
        videos: {},
      }
    }
    case 'getsubscribesfeed': {
      // Лента подписок вошедшего (`subscribes`): свежие первыми, страница — после `txid`.
      const [, fromTxid, count] = params as [unknown, string, number]
      const followed = new Set(data.subscribes ?? [])
      const feed = data.posts
        .map((p, i) => [p, i] as const)
        .filter(([p]) => inLanguage(p, params))
        .map(([p, i]) => postJson(p, data, i))
        .filter((p) => followed.has(p.address))
        .sort((a, b) => b.time - a.time)
      const start = fromTxid ? feed.findIndex((p) => p.txid === fromTxid) + 1 : 0
      return {
        height: HEIGHT,
        contents: feed.slice(start, start + (count || feed.length)),
        users: [],
        videos: {},
      }
    }
    case 'gethierarchicalstrip':
    case 'gethistoricalstrip':
    case 'gettopfeed':
      return {
        height: HEIGHT,
        contents: data.posts
          .map((p, i) => [p, i] as const)
          .filter(([p]) => !p.byIdOnly && inLanguage(p, params))
          .map(([p, i]) => postJson(p, data, i)),
        users: [],
        videos: {},
      }
    case 'getrawtransactionwithmessagebyid': {
      // Как у настоящей ноды: на id комментария — null.
      const ids = (params[0] as string[]) ?? []
      return ids.map((id) => {
        const ci = (data.collections ?? []).findIndex((c) => c.txid === id)
        if (ci >= 0) return collectionShareJson(data.collections![ci]!, ci, data)
        const i = data.posts.findIndex((p) => p.txid === id)
        return i < 0 ? null : postJson(data.posts[i]!, data, i)
      })
    }
    case 'getuserprofile': {
      const addresses = (params[0] as string[]) ?? []
      return data.profiles.filter((p) => addresses.includes(p.address)).map(profileJson)
    }
    case 'searchusers': {
      // [текст, 'users', блок, сдвиг, сколько]: имя содержит текст, без учёта регистра.
      const text = String(params[0] ?? '').toLowerCase()
      const count = Number(params[4] ?? 10)
      return data.profiles
        .filter((p) => (p.name ?? '').toLowerCase().includes(text))
        .slice(0, count)
        .map(profileJson)
    }
    case 'getcomments': {
      // [пост, ветка, читатель, id]: со списком id — эти комментарии с любого
      // поста; иначе корневые комментарии поста или ответы ветки.
      const [postId, parentId, , ids] = params as [string, string, string, string[]?]
      return data.comments
        .map((c, i) => [c, i] as const)
        .filter(([c]) =>
          ids?.length
            ? ids.includes(c.id)
            : c.postid === postId && (c.parentid ?? '') === (parentId ?? '')
        )
        .map(([c, i]) => commentJson(c, i, data))
    }
    case 'getusersubscribers': {
      // [адрес, порядок, по убыванию, смещение, сколько]. Как у настоящей
      // ноды: по репутации — с репутацией ×10, смещение не учитывается.
      const [owner, orderBy, , , limit] = params as [string, string?, boolean?, number?, number?]
      const list = data.profiles.find((p) => p.address === owner)?.subscribers ?? []
      if (orderBy !== 'reputation') return list.map((address) => ({ address, private: 'false' }))
      return list
        .map((address) => ({
          address,
          private: 0,
          reputation: (data.profiles.find((p) => p.address === address)?.reputation ?? 120) * 10,
        }))
        .sort((a, b) => b.reputation - a.reputation)
        .slice(0, limit || 10)
    }
    case 'getuseraddress': {
      const name = String(params[0] ?? '').toLowerCase()
      const owner = data.profiles.find((p) => p.name.toLowerCase() === name)
      return owner ? [{ name: owner.name, address: owner.address }] : []
    }
    case 'getusersubscribes':
      // Поле с опечаткой, как у настоящей ноды.
      return (data.subscribes ?? []).map((adddress) => ({ adddress, private: 'false' }))
    case 'getaccountsetting': {
      // Нода отдаёт настройки JSON-строкой; у аккаунта без них — пусто.
      const settings = data.settings?.[params[0] as string]
      return settings ? JSON.stringify(settings) : ''
    }
    case 'gettags':
      return (data.tags ?? []).map((tag, i) => ({ tag, count: 100 - i }))
    case 'getboostfeed':
      return { height: HEIGHT, boosts: data.boosts ?? [] }
    case 'getnodeinfo':
      return { lastblock: { height: HEIGHT } }
    default:
      return []
  }
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

async function answerNode(route: Route, data: MockNodeData): Promise<void> {
  const request = route.request()
  if (request.method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: CORS })
    return
  }
  const path = new URL(request.url()).pathname
  if (path === '/ping') {
    await route.fulfill({
      status: 200,
      headers: CORS,
      json: { result: 'success', data: { session: 'mock', v: '0809', height: HEIGHT } },
    })
    return
  }
  const method = path.split('/').pop() ?? ''
  if (data.network && (path === '/info' || method === 'getpeerinfo' || method === 'getnodeinfo')) {
    let node: string | undefined
    try {
      node = (request.postDataJSON() as { options?: { node?: string } })?.options?.node
    } catch {
      node = undefined
    }
    const answer = networkAnswer(data.network, path, method, node)
    if (answer) {
      await route.fulfill({ status: 200, headers: CORS, json: { result: 'success', ...answer } })
    } else {
      await route.fulfill({ status: 408, headers: CORS, json: { error: 'timeout' } })
    }
    return
  }
  if (method === 'urlPreview') {
    let link = ''
    try {
      link = String((request.postDataJSON() as { url?: unknown })?.url ?? '')
    } catch {
      // без тела — превью нет
    }
    await route.fulfill({
      status: 200,
      headers: CORS,
      json: { result: 'success', data: { og: data.linkPreviews?.[link] ?? null } },
    })
    return
  }
  if (/^sendrawtransaction/.test(method)) {
    // Публикация в тестах запрещена: даже по ошибке ничего не уходит в сеть.
    await route.fulfill({ status: 500, headers: CORS, json: { error: 'mock node: no broadcasts' } })
    return
  }
  let params: unknown[]
  try {
    params = (request.postDataJSON() as { parameters?: unknown[] })?.parameters ?? []
  } catch {
    params = []
  }
  // Как настоящая нода (сверено 28.10.2026): полные профили (без '1') с
  // десяти адресов она не успевает собрать и отвечает таймаутом SQL.
  if (
    method === 'getuserprofile' &&
    params[1] !== '1' &&
    Array.isArray(params[0]) &&
    params[0].length >= 10
  ) {
    await route.fulfill({
      status: 500,
      headers: CORS,
      json: {
        error: {
          code: 500,
          message: '{"code":408,"message":"GetAccountProfiles: sql request timeout"}',
        },
      },
    })
    return
  }
  await route.fulfill({
    status: 200,
    headers: CORS,
    json: { result: 'success', data: rpcResult(method, params, data) },
  })
}

/**
 * Включает подменную ноду и обрывает остальной внешний трафик. `allow` —
 * адреса, которые живой тест пускает в настоящую сеть.
 */
export async function useMockNode(
  page: Page,
  data: MockNodeData,
  allow?: (url: string) => boolean
): Promise<void> {
  await page.context().route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, async (route) => {
    const url = route.request().url()
    if (/\.pocketnet\.app:8899\//.test(url)) {
      await answerNode(route, data)
    } else if (allow?.(url)) {
      await route.continue()
    } else {
      await route.abort()
    }
  })
}
