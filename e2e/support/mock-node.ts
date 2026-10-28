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
  /** Баланс в PKOIN (`getaddressinfo`); по умолчанию 0. */
  balance?: number
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

export interface MockNodeData {
  profiles: MockProfile[]
  posts: MockPost[]
  comments: MockComment[]
  /** На кого подписан вошедший (`getusersubscribes`). */
  subscribes?: string[]
  /** Настройки аккаунтов (`getaccountsetting`): обложка, цена подписки… */
  settings?: Record<string, Record<string, unknown>>
  /** Облако популярных тегов (`gettags`): подсказки тегов в форме поста. */
  tags?: string[]
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
    l: 'ru',
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

function rpcResult(method: string, params: unknown[], data: MockNodeData): unknown {
  switch (method) {
    case 'getprofilefeed': {
      // Лента автора, как у ноды: свежие первыми, страница — после поста `txid`.
      const [, fromTxid, count, , , , , , , , address] = params as [
        unknown,
        string,
        number,
        ...unknown[],
      ]
      const own = data.posts
        .map((p, i) => postJson(p, data, i))
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
    case 'gethierarchicalstrip':
    case 'gethistoricalstrip':
    case 'gettopfeed':
      return {
        height: HEIGHT,
        contents: data.posts.map((p, i) => postJson(p, data, i)),
        users: [],
        videos: {},
      }
    case 'getrawtransactionwithmessagebyid': {
      // Как у настоящей ноды: на id комментария — null.
      const ids = (params[0] as string[]) ?? []
      return ids.map((id) => {
        const i = data.posts.findIndex((p) => p.txid === id)
        return i < 0 ? null : postJson(data.posts[i]!, data, i)
      })
    }
    case 'getuserprofile': {
      const addresses = (params[0] as string[]) ?? []
      return data.profiles.filter((p) => addresses.includes(p.address)).map(profileJson)
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
    case 'getaddressinfo': {
      const balance = data.profiles.find((p) => p.address === params[0])?.balance ?? 0
      return { lastChange: -1, balance }
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
      return { height: HEIGHT, boosts: [] }
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
