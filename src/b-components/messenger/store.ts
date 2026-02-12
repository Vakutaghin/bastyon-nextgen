import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { Buffer } from 'buffer'
import CryptoJS from 'crypto-js'

import { useAuthStore } from '@/blockchain'
import { deriveMessengerKeys } from '@/blockchain/core/keys'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { getByPRC } from '@/helpers/api/request'
import type { UserProfile } from '@/types/rpc-responses/user-get'
import { PcryptoService, type User as PcryptoUser } from './services/pcrypto'
import { matrixService } from './services/matrix-service'
import glassSound from './sounds/glass.mp3'
import type { Dialog, Message, User } from './types'

// Helper functions for hex and base64 conversion
function hexStringToUint8Array(hexString: string): Uint8Array {
  const bytes = new Uint8Array(hexString.length / 2)
  for (let i = 0; i < hexString.length; i += 2) {
    bytes[i / 2] = parseInt(hexString.substr(i, 2), 16)
  }
  return bytes
}

function base64StringToUint8Array(base64String: string): Uint8Array {
  const binaryString = atob(base64String)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

// Helper to safely get event ID
const getEventId = (event: any): string => {
  if (!event) return 'unknown'
  if (typeof event.getId === 'function') return event.getId()
  return event.event_id || event.id || 'unknown'
}

const getEventContent = (event: any): any => {
  if (!event) return {}
  if (typeof event.getContent === 'function') return event.getContent()
  return event.content || {}
}

const getEventType = (event: any): string => {
  if (!event) return 'unknown'
  if (typeof event.getType === 'function') return event.getType()
  return event.type || 'unknown'
}

const getEventRoomId = (event: any): string => {
  if (!event) return 'unknown'
  if (typeof event.getRoomId === 'function') return event.getRoomId()
  return event.room_id || 'unknown'
}

const getEventSender = (event: any): string => {
  if (!event) return 'unknown'
  if (typeof event.getSender === 'function') return event.getSender()
  return event.sender || 'unknown'
}

const getEventTs = (event: any): number => {
  if (!event) return 0
  if (typeof event.getTs === 'function') return event.getTs()
  return event.origin_server_ts || 0
}

const isRenderableMessageEvent = (event: any): boolean => {
  const type = getEventType(event)
  if (type === 'm.room.encrypted') return true
  if (type !== 'm.room.message') return false
  const content = getEventContent(event)
  const msgtype = content.msgtype
  if (msgtype === 'm.text' || msgtype === 'm.notice' || msgtype === 'm.emote' || msgtype === 'm.encrypted' || msgtype === 'm.audio') return true
  return typeof content.body === 'string' && content.body.trim().length > 0
}

const getMatrixId = (userId: string): string => {
  if (!userId) return ''
  return userId.split(':')[0]?.replace('@', '') || ''
}

const tetatetid = (user1: string, user2: string): string | null => {
  if (!user1 || !user2 || user1 === user2) return null
  const id1 = parseInt(user1, 16)
  const id2 = parseInt(user2, 16)
  if (Number.isNaN(id1) || Number.isNaN(id2)) return null
  const seed = 2
  const id = id1 * id2 * seed
  return CryptoJS.SHA224(id.toString()).toString(CryptoJS.enc.Hex)
}

const isTetatetchat = (room: any): boolean => {
  if (!room) return false
  if (typeof room.tetatet !== 'undefined') return room.tetatet
  const members = typeof room.getJoinedMembers === 'function'
    ? room.getJoinedMembers()
    : (room.currentState?.getMembers ? room.currentState.getMembers() : [])
  if (!members || members.length !== 2) return false
  const ids = members.map((m: any) => getMatrixId(m.userId)).filter(Boolean)
  if (ids.length !== 2) return false
  const tid = tetatetid(ids[0], ids[1])
  if (!tid) return false
  const roomName = room.name || ''
  const alias = typeof room.getCanonicalAlias === 'function' ? room.getCanonicalAlias() || '' : ''
  const tt = roomName === `#${tid}` || alias.includes(tid)
  if (members.length > 1) room.tetatet = tt
  return tt
}

// Helper to detect audio MIME type from bytes
const detectAudioMime = (bytes: Uint8Array): string | null => {
    if (!bytes || bytes.length < 4) return null
    // ID3 (MP3)
    if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return 'audio/mpeg'
    // MP3 (Frame sync - FFFB/FFFA usually)
    if (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0) return 'audio/mpeg'
    // Ogg
    if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) return 'audio/ogg'
    // WAV
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return 'audio/wav'
    // AAC (ADTS)
    if (bytes[0] === 0xFF && (bytes[1] & 0xF0) === 0xF0) return 'audio/aac'
    // WebM / Matroska (1A 45 DF A3)
    if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) return 'audio/webm'
    // FLAC (fLaC)
    if (bytes[0] === 0x66 && bytes[1] === 0x4C && bytes[2] === 0x61 && bytes[3] === 0x43) return 'audio/flac'

    return null
}

export const useMessengerStore = defineStore('messenger', () => {
  // State
  const authStore = useAuthStore()
  const isOpen = ref(false)
  const isFullScreen = ref(false)
  const activeChatId = ref<string | null>(null)
  const dialogs = ref<Dialog[]>([])
  const messages = ref<Record<string, Message[]>>({})
  const currentUser = ref<User>({
    id: 'me',
    name: 'Я',
    avatar: 'https://via.placeholder.com/150',
  })
  const lastTargetAddress = ref<string | null>(null)
  /** true только при явном открытии приглашения (профиль/пост); сбрасывается при выходе в список или открытии чата — убирает моргание */
  const inviteViewActive = ref(false)
  const isSyncStarted = ref(false)
  const isLoading = ref(false)
  const isMessagesLoading = ref(false)
  /** true после первой успешной загрузки списка диалогов — пока false, в списке показываем прелоадер */
  const dialogsLoadedOnce = ref(false)
  const syncState = ref<string>('STOPPED')
  const syncError = ref<string | null>(null)
  const userProfiles = ref<Record<string, UserProfile>>({})
  const pcryptoService = ref<PcryptoService | null>(null)
  const localMessengerKeys = ref<{ private: string; public: string }[] | null>(null)
  const isInitInProgress = ref(false)

  // Helpers
  const getAvatarUrl = (imageHash?: string): string | undefined => {
    if (!imageHash) return undefined
    if (imageHash.startsWith('http://') || imageHash.startsWith('https://')) {
      const r = imageHash.replace('://bastyon.com:8092/', '://pocketnet.app:8092/')
      return r
    }
    return `https://pocketnet.app:8092/i/${imageHash}`
  }

  const getAddressFromMatrixId = (matrixId: string): string | null => {
    if (matrixId && matrixId.startsWith('@') && matrixId.includes(':')) {
      const parts = matrixId.split(':')
      let userId = parts[0].substring(1)

      // Handle hex encoded addresses (standard for Bastyon)
      if (/^(0x)?[0-9a-fA-F]+$/.test(userId)) {
        if (userId.startsWith('0x')) userId = userId.substring(2)
        const address = matrixService.hexToAddress(userId)
        // Ensure the address is valid (simple check)
        if (address && address.length > 10) return address
        return null
      }

      // Handle direct addresses (if used as ID)
      return userId
    }
    return null
  }

  const getMatrixAvatarUrl = (
    mxcUrl?: string | null,
    size = 40,
  ): string | undefined => {
    if (!mxcUrl) return undefined

    const client = matrixService.getClient()

    if (client?.mxcUrlToHttp) {
      return client.mxcUrlToHttp(mxcUrl, size, size, 'crop')
    }

    try {
      const match = /^mxc:\/\/([^/]+)\/(.+)$/.exec(mxcUrl)
      if (!match) return undefined
      const server = match[1]
      const mediaId = match[2]
      const base = matrixService.getBaseUrl()
      const baseIsLocal = !/^https?:\/\//.test(base) || /localhost|127\.0\.0\.1/.test(base)
      const host = baseIsLocal ? 'https://matrix.bastyon.com' : base
      return `${host}/_matrix/media/r0/thumbnail/${server}/${mediaId}?width=${size}&height=${size}&method=crop`
    } catch (_e) {
      return undefined
    }
  }

  const syncCurrentUser = async () => {
    const client = matrixService.getClient()
    const myMatrixId = client?.getUserId()
    if (myMatrixId) {
      currentUser.value.id = myMatrixId
    }
    const address = authStore.address
    if (!address) return
    await fetchProfiles([address])
    const profile = userProfiles.value[address]
    if (profile?.name) currentUser.value.name = profile.name
    if (profile?.i) {
      const avatar = getAvatarUrl(profile.i)
      if (avatar) currentUser.value.avatar = avatar
    }
  }

  const pendingResolvers = new Map<string, Array<() => void>>()
  let profileFetchQueue: string[] = []
  let profileFetchTimeout: any = null
  const currentBlockHeight = ref<number | null>(null)
  let currentBlockFetchedAt = 0

  const processProfileQueue = async () => {
    if (profileFetchQueue.length === 0) return

    const addressesToFetch = [...new Set(profileFetchQueue)]
    profileFetchQueue = []

    // Split into batches
    const BATCH_SIZE = 20
    const batches = []
    for (let i = 0; i < addressesToFetch.length; i += BATCH_SIZE) {
      batches.push(addressesToFetch.slice(i, i + BATCH_SIZE))
    }

    for (const batch of batches) {
      try {
        const result = await getByPRC({
          method: rpcEndpoints.getUserProfile,
          parameters: [[...batch]],
          cachehash: Date.now().toString() + Math.random().toString()
        }) as any

        const profiles = Array.isArray(result) ? result : (result?.data || [])

        if (Array.isArray(profiles)) {
          profiles.forEach((profile: UserProfile) => {
            if (profile && profile.address) {
              userProfiles.value[profile.address] = profile
            }
          })
        }
      } catch (e) {
        console.error('[MessengerStore] Failed to fetch user profiles batch:', e)
      } finally {
        // Resolve promises for processed addresses to unblock waiters
        batch.forEach(addr => {
          const resolvers = pendingResolvers.get(addr)
          if (resolvers) {
            resolvers.forEach(r => r())
            pendingResolvers.delete(addr)
          }
        })
      }
    }
  }

  const fetchProfiles = (addresses: string[]): Promise<void> => {
    const missing = addresses.filter(a => !userProfiles.value[a])
    if (missing.length === 0) return Promise.resolve()

    const promises: Promise<void>[] = []

    missing.forEach(a => {
      // If not already pending, add to queue
      if (!pendingResolvers.has(a)) {
        pendingResolvers.set(a, [])
        profileFetchQueue.push(a)
      }

      // Create a promise for this address
      const p = new Promise<void>((resolve) => {
        const resolvers = pendingResolvers.get(a)
        if (resolvers) resolvers.push(resolve)
        else resolve() // Should not happen if logic above is correct
      })
      promises.push(p)
    })

    if (profileFetchTimeout) clearTimeout(profileFetchTimeout)
    profileFetchTimeout = setTimeout(processProfileQueue, 100)

    return Promise.all(promises).then(() => {})
  }

  const getCurrentBlockHeight = async (): Promise<number | null> => {
    const now = Date.now()
    if (currentBlockHeight.value && now - currentBlockFetchedAt < 55000) {
      return currentBlockHeight.value
    }
    try {
      const response = await getByPRC({
        method: rpcEndpoints.getNodeInfo,
        parameters: [],
        options: { auth: false }
      }) as any
      const data = response?.data || response
      const height = data?.lastblock?.height
      if (typeof height === 'number' && height > 0) {
        currentBlockHeight.value = height
        currentBlockFetchedAt = now
        return height
      }
    } catch (e) {}
    return currentBlockHeight.value
  }

  const parseProfileKeys = (keys?: string): string[] => {
    if (!keys) return []
    return keys
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)
  }

  const applyBlockToContent = (content: any, block: number) => {
    if (!content || !block) return
    if (content.info?.secrets) content.info.secrets.block = block
    if (content.pbody?.secrets) content.pbody.secrets.block = block
    if (content.secrets) content.secrets.block = block
    content.block = block
  }

  // Matrix Helpers
  const getRoomTimelineEvents = (room: any): any[] => {
    if (!room) return []
    if (typeof room.getLiveTimeline === 'function') {
      const liveTimeline = room.getLiveTimeline()
      if (liveTimeline && typeof liveTimeline.getEvents === 'function') {
        return liveTimeline.getEvents()
      }
    }
    return Array.isArray(room.timeline) ? room.timeline : []
  }

  const paginateRoomHistory = async (room: any) => {
    const client = matrixService.getClient()
    if (!client || !room || typeof room.getLiveTimeline !== 'function') return
    const liveTimeline = room.getLiveTimeline()

    // Check how many events we already have
    // If we have less than 30, try to fetch more to reach at least ~30
    const currentEvents = liveTimeline.getEvents()
    if (currentEvents.length < 30) {
      await client.paginateEventTimeline(liveTimeline, {
        backwards: true,
        limit: 30
      })
    }
  }

  let isLoadingMore = false

  const loadMoreMessages = async (chatId: string) => {
    if (!chatId) return

    if (isLoadingMore) return

    const room = matrixService.getRoom(chatId)

    if (!room) return

    isLoadingMore = true

    try {
      const client = matrixService.getClient()
      const liveTimeline = room.getLiveTimeline()

      const initialCount = liveTimeline.getEvents().length

      const result = await client.paginateEventTimeline(liveTimeline, {
        backwards: true,
        limit: 30
      })

      const finalCount = liveTimeline.getEvents().length

      if (finalCount > initialCount) {
        const timelineEvents = getRoomTimelineEvents(room)
        const mapped = await Promise.all(timelineEvents.map((e: any) => mapEventToMessage(e)))
        messages.value[chatId] = mapped.filter((m): m is Message => Boolean(m))
      }
    } catch(e) {
      console.error('[MessengerStore] Failed to load more messages', e)
    } finally {
      isLoadingMore = false
    }
  }

  const getMemberHistoryEvents = (room: any): any[] => {
    if (!room) return []
    const seen = new Map<string, any>()
    const addEvents = (events: any[]) => {
      events.forEach((ev) => {
        const id = getEventId(ev)
        if (!seen.has(id)) {
          seen.set(id, ev)
        }
      })
    }
    if (room.currentState?.getStateEvents) {
      addEvents(room.currentState.getStateEvents('m.room.member') || [])
    }
    if (room.oldState?.getStateEvents) {
      addEvents(room.oldState.getStateEvents('m.room.member') || [])
    }
    return Array.from(seen.values())
  }

  const getOrderedMemberIds = (room: any, time: number | null): string[] => {
    if (!room) return []
    const isDirect = isTetatetchat(room)
    const historyEvents = getMemberHistoryEvents(room)
    if (historyEvents.length === 0) {
      const members = room.currentState?.getMembers ? room.currentState.getMembers() : []
      return members
        .filter((m: any) => m.membership === 'join' || m.membership === 'invite' || m.membership === 'leave')
        .map((m: any) => m.userId)
    }
    const history = (historyEvents
      .map((ev) => {
        const content = getEventContent(ev)
        const membership = content?.membership
        if (membership !== 'join' && membership !== 'invite' && membership !== 'leave') return null
        const stateKey = typeof ev.getStateKey === 'function'
          ? ev.getStateKey()
          : (ev.state_key || ev?.event?.state_key)
        const sender = getEventSender(ev)
        const id = membership === 'invite' ? stateKey : sender
        if (!id) return null
        return {
          time: getEventTs(ev) || 1,
          membership,
          id
        }
      })
      .filter(Boolean) as Array<{ time: number; membership: string; id: string }>)
      .sort((a, b) => a.time - b.time)
    const users = new Map<string, { life: Array<{ start: number; end?: number }> }>()
    history.forEach((h) => {
      if (!users.has(h.id)) users.set(h.id, { life: [] })
      const life = users.get(h.id)!.life
      if (h.membership === 'join' || h.membership === 'invite') {
        life.push({ start: isDirect ? 1 : h.time })
      } else if (h.membership === 'leave' && !isDirect) {
        const last = life[life.length - 1]
        if (last && !last.end) last.end = h.time
      }
    })
    const targetTime = time || 1
    const memberIds: string[] = []
    users.forEach((u, id) => {
      const active = u.life.some((l) => {
        if (!targetTime) return l.start && !l.end
        return l.start < targetTime && (!l.end || l.end > targetTime)
      })
      if (active) memberIds.push(id)
    })
    if (memberIds.length === 0) {
      users.forEach((_u, id) => memberIds.push(id))
    }
    return memberIds
  }

  const tryDecrypt = async (event: any): Promise<string | null> => {
    const eventId = getEventId(event)

    if (!pcryptoService.value) {
      console.warn('[MessengerStore] tryDecrypt: PcryptoService not initialized')
      return null
    }

    const content = getEventContent(event)
    const isEncryptedType = getEventType(event) === 'm.room.encrypted'

    // Explicitly type check and cast to avoid implicit any
    let secrets: any = null
    if (content.info && content.info.secrets) secrets = content.info.secrets
    else if (content.pbody && content.pbody.secrets) secrets = content.pbody.secrets

    let hasSecrets = !!secrets

    // Check if content itself has 'secrets' (sometimes it's top level?)
    if (!hasSecrets && content.secrets) {
        secrets = content.secrets
        hasSecrets = true
    }

    // Check if body is base64 encoded JSON that contains secrets?
    if (!hasSecrets && content.body && typeof content.body === 'string' && content.body.startsWith('ey')) {
      try {
        const decoded = atob(content.body)
        if (decoded.startsWith('{') && (decoded.includes('"encrypted"') || (decoded.includes('"keys"') && decoded.includes('"cipher"')))) {
          if (!content.info) content.info = {}
          content.info.secrets = {
            keys: content.body,
            block: content.block || content.info?.block || (JSON.parse(decoded).block) || 0
          }
          secrets = content.info.secrets
          hasSecrets = true
        }
      } catch (e) {}
    }

    if (!isEncryptedType && !hasSecrets) {
      return null
    }

    try {
      const room = matrixService.getRoom(getEventRoomId(event))

      if (!room) {
        console.warn('[MessengerStore] tryDecrypt: Room not found', getEventRoomId(event))
        return null
      }

      const memberIds = getOrderedMemberIds(room, getEventTs(event))
      const isDirect = isTetatetchat(room)
      if (secrets && !secrets.block && content?.block) {
        secrets.block = content.block
      }
      let effectiveBlock = secrets?.block || content?.block || 0
      if ((!effectiveBlock || effectiveBlock === 0) && isDirect) {
        const currentBlock = await getCurrentBlockHeight()
        if (currentBlock) {
          effectiveBlock = currentBlock
          applyBlockToContent(content, currentBlock)
        }
      }
      if (effectiveBlock) {
        applyBlockToContent(content, effectiveBlock)
      }

      // Collect addresses to fetch profiles
      const addressesToFetch: string[] = []
      for (const memberId of memberIds) {
        const address = getAddressFromMatrixId(memberId)
        if (address && !userProfiles.value[address]) {
          addressesToFetch.push(address)
        }
      }

      const myMatrixId = matrixService.getClient()?.getUserId()
      const myAddress = myMatrixId ? getAddressFromMatrixId(myMatrixId) : null
      if (myAddress && !userProfiles.value[myAddress]) {
        addressesToFetch.push(myAddress)
      }

      // Ensure profiles are loaded (critical for keys and dbId)
      if (addressesToFetch.length > 0) {
        await fetchProfiles(addressesToFetch)
      }

      const users: PcryptoUser[] = []

      // Add members to users list
      for (const memberId of memberIds) {
        const address = getAddressFromMatrixId(memberId)
        const isMe = !!myMatrixId && memberId === myMatrixId

        if (isMe) {
          if (address && userProfiles.value[address]?.k) {
            users.push({
              id: memberId,
              keys: parseProfileKeys(userProfiles.value[address].k),
              dbId: (userProfiles.value[address] as any).id
            })
            continue
          }
          if (localMessengerKeys.value) {
            users.push({
              id: memberId,
              keys: localMessengerKeys.value.map(k => k.public),
              dbId: address && userProfiles.value[address] ? (userProfiles.value[address] as any).id : undefined
            })
            continue
          }
        }

        if (address && userProfiles.value[address] && userProfiles.value[address].k) {
          users.push({
            id: memberId,
            keys: parseProfileKeys(userProfiles.value[address].k),
            dbId: (userProfiles.value[address] as any).id
          })
        } else {
             // console.warn(`[MessengerStore] Profile or keys missing for ${address} (${member.userId})`)
        }
      }

      let version = content?.version
      if (!version) {
        version =
          content?.info?.secrets?.version ||
          content?.info?.secrets?.v ||
          content?.pbody?.secrets?.version ||
          content?.pbody?.secrets?.v ||
          content?.secrets?.version ||
          content?.secrets?.v
      }
      if (version && version > 1) {
        users.sort((a, b) => {
          const dbIdA = a.dbId || 0
          const dbIdB = b.dbId || 0
          if (dbIdA !== dbIdB) {
              return dbIdA - dbIdB
          }
          return a.id.localeCompare(b.id)
        })
      }

      // If we are in a DM (2 people), but found only 1 user (me), decryption will fail
      // We must ensure we have keys for the sender if it's not me
      const sender = getEventSender(event)
      if (!users.find(u => u.id === sender)) {
        console.warn(`[MessengerStore] Missing keys for sender ${sender} in event ${eventId}`)
        // We can't decrypt without sender's public key (to derive shared secret)
        // Try to fetch sender profile explicitly if missed
        const senderAddr = getAddressFromMatrixId(sender)
        if (senderAddr) {
             await fetchProfiles([senderAddr])
             if (userProfiles.value[senderAddr]) {
                 const p = userProfiles.value[senderAddr]
                 users.push({
                     id: sender,
                     keys: parseProfileKeys(p.k),
                     dbId: (p as any).id
                 })
             }
        }

        if (!users.find(u => u.id === sender)) {
             return null
        }
      }

      // Pass raw event object if it's a wrapper, or the object itself if it's raw
      // The Matrix wrapper usually has .event property with raw JSON
      const rawEvent = (event as any).event
        ? { ...(event as any).event, content }
        : { ...event, content }

      const decrypted = await pcryptoService.value.decryptEvent(rawEvent, users)

      return decrypted
    } catch (e: any) {
      console.error(`[MessengerStore] Decryption failed for ${eventId}:`, e.message || e, e.stack)
      return null
    }
  }

  const mapEventToMessage = async (event: any, skipDecryption = false): Promise<Message | null> => {
    if (!isRenderableMessageEvent(event)) return null
    const eventId = getEventId(event)
    const content = getEventContent(event)
    let text = content.body || ''
    let type: 'text' | 'audio' | 'image' | 'file' = 'text'
    let url: string | undefined = undefined
    let info: any = undefined
    let finalContent = content
    const extractUrl = (u: any): string | null => {
      if (!u) return null
      if (typeof u === 'string') return u
      if (typeof u === 'object') {
        if (typeof u.uri === 'string') return u.uri
        if (typeof u.url === 'string') return u.url
      }
      return null
    }


    if (content.msgtype === 'm.audio') {
      type = 'audio'
      const audioUrl =
        extractUrl(content.url) ||
        extractUrl(content.file?.url) ||
        extractUrl(content.info?.url) ||
        extractUrl(content.info?.file?.url) ||
        (typeof content.body === 'string' && content.body.startsWith('http') ? content.body : null)

      if (typeof audioUrl === 'string' && audioUrl.length > 0) {
        if (audioUrl.startsWith('http')) {
          url = audioUrl
        } else {
          const client = matrixService.getClient()
          if (client && client.mxcUrlToHttp) {
            url = client.mxcUrlToHttp(audioUrl)
          } else {
            url = audioUrl
          }
        }
      }

      // If we have a URL, let's try to fetch it as a blob if it's an encrypted content type
      // or if we suspect it needs special handling.
      // Actually, the server returns content-type: encrypted/audio/mpeg
      // Browsers might not support this content type directly in <audio> tag.
      // We need to fetch it as blob and create an object URL with correct type.

      if (url && url.startsWith('http')) {
         // We'll attach a special flag or handle this in the component
         // But wait, we can't easily do async fetch here for every message in the list efficiently
         // Ideally, the component should handle the blob fetching if needed.
         // Let's pass the URL as is, and update the component to handle 'encrypted/' types or fetch errors.

         // However, we can try to "fix" the URL if it's from our known server
         // But the issue is likely the Content-Type header 'encrypted/audio/mpeg'
      }

      info = content.info
      // Pass file info for decryption if present
      if (content.file) {
          if (!info) info = {}
          info.file = content.file
      }
    }

    // Check if we should try decrypting
    const isEncryptedType = getEventType(event) === 'm.room.encrypted'

    // Check nested secrets or if body itself is a JSON with 'encrypted'
    let hasSecrets = (content.info && content.info.secrets) || (content.pbody && content.pbody.secrets)

    // Also check if content itself has 'secrets' (sometimes it's top level?)
    if (!hasSecrets && content.secrets) hasSecrets = content.secrets

    // Check if body is base64 encoded JSON that contains secrets?
    // User showed snippet: {"5039...": {"encrypted": "..."}}
    // This looks like the 'secrets' object itself.
    // Maybe 'body' IS the secrets string? Or 'body' contains the encrypted text?

    // If msgtype is 'm.text' and body starts with 'ey' (base64 for '{'), it might be the secrets!
    // We need to distinguish.

    // Let's try to detect if 'body' looks like our specific encrypted payload (JSON with keys being hex/addresses)
    // User logs show 'info' and 'pbody' are MISSING in keys (only body, msgtype).
    // This implies the encrypted data MUST be in 'body'.

    // Check if body is a URL (sometimes clients send audio URL as body for compatibility)
    if (content.msgtype === 'm.audio' && content.body && content.body.startsWith('http')) {
        // Do nothing here, it will be handled in main logic
    }
    else if (!hasSecrets && content.body && typeof content.body === 'string' && content.body.startsWith('ey')) {
      try {
        // Check if it parses to JSON and has keys looking like our addresses/hex?
        const decoded = atob(content.body)
        // Check for standard encrypted fields: 'encrypted' (old), or 'cipher'/'keys'/'iv' (new)
        if (decoded.startsWith('{') && (decoded.includes('"encrypted"') || (decoded.includes('"keys"') && decoded.includes('"cipher"')))) {
          // It looks like secrets!

          // Try to extract block from the JSON if present
          let extractedBlock = 0
          try {
             const json = JSON.parse(decoded)
             if (json.block) extractedBlock = json.block
          } catch (e) {}

          // Construct a fake 'secrets' object for tryDecrypt to use
          // Let's inject it into content so tryDecrypt finds it
          if (!content.info) content.info = {}
          content.info.secrets = {
            keys: content.body,
            block: content.block || extractedBlock
          }
          hasSecrets = content.info.secrets
        }
      } catch (e) {}
    }

    const shouldDecrypt = (isEncryptedType || hasSecrets) && !skipDecryption

    if (shouldDecrypt) {
      const decrypted = await tryDecrypt(event)
      if (decrypted) {
        try {
          // Try to parse as JSON (it might be a structured Matrix event content)
          const parsed = JSON.parse(decrypted)
          if (parsed && typeof parsed === 'object') {
            finalContent = parsed
            if (parsed.msgtype === 'm.audio') {
              type = 'audio'
              const pUrl =
                extractUrl(parsed.url) ||
                extractUrl(parsed.file?.url) ||
                extractUrl(parsed.info?.file?.url) ||
                extractUrl(parsed.info?.url) ||
                (typeof parsed.body === 'string' && parsed.body.startsWith('http') ? parsed.body : null)
              if (typeof pUrl === 'string' && pUrl.length > 0) {
                if (pUrl.startsWith('http')) {
                  url = pUrl
                } else {
                  const client = matrixService.getClient()
                  if (client && client.mxcUrlToHttp) {
                    url = client.mxcUrlToHttp(pUrl)
                  } else {
                    url = pUrl
                  }
                }
              }

              if (parsed.info) info = parsed.info
              if (parsed.file) {
                  if (!info) info = {}
                  info.file = parsed.file
              }
              text = parsed.body || ''
            } else if (parsed.body) {
              // If it's another type of message but has body, use it
              text = parsed.body
            } else {
              // Fallback to original decrypted string if structure is unclear
              text = decrypted
            }
          } else {
            text = decrypted
          }
        } catch (e) {
          // Not JSON, use as is
          text = decrypted
        }
      } else {
        // Fallback: If decryption returns null, it might be because of missing keys or other issues
        // But if event has 'body' which is NOT '*** Encrypted Message ***' (default from some clients),
        // we might display it as is (could be raw ciphertext or fallback text)

        if (content.body) {
          text = content.body
        } else {
          text = '*** Encrypted Message ***'
        }
      }
    } else if ((isEncryptedType || hasSecrets) && skipDecryption) {
      // In list view (dialogs), show placeholder or body if available (but body is usually encrypted text)
      // Actually, Matrix spec says body contains "readable" fallback, but in our case it might be the ciphertext or 'Encrypted message' string
      if (content.body && !content.body.includes('***') && content.body.length < 100) {
        // If body is short and doesn't look like ciphertext (ciphertext is usually long base64), maybe show it?
        // But usually it IS ciphertext or "Encrypted message"
        text = content.body
      } else {
        text = '*** Encrypted Message ***'
      }
    }

    let textToRender = typeof text === 'string' ? text : String(text || '')
    if (!textToRender.trim() && type !== 'audio') {
      if (isEncryptedType || content.msgtype === 'm.encrypted') {
        textToRender = '*** Encrypted Message ***'
      } else {
        return null
      }
    }

    const senderId = getEventSender(event)
    let senderName = senderId
    if (senderId === currentUser.value.id || senderId === 'me') {
      senderName = currentUser.value.name || 'Вы'
    } else {
      const address = getAddressFromMatrixId(senderId)
      if (address) {
        if (userProfiles.value[address]?.name) {
          senderName = userProfiles.value[address].name
        } else {
          fetchProfiles([address])
        }
      }
    }

    return {
      id: eventId,
      chatId: getEventRoomId(event),
      senderId,
      senderName,
      text: textToRender,
      type,
      url,
      info,
      rawContent: finalContent,
      timestamp: getEventTs(event),
      read: false,
      status: 'sent'
    }
  }

  const ensurePcryptoInitialized = () => {
    if (pcryptoService.value) return
    if (!authStore.isUserAuthenticated || !authStore.keyPair) return

    const client = matrixService.getClient()

    if (!client) return

    try {
      const keys = deriveMessengerKeys(authStore.keyPair.privateKey)
      const myUserId = client.getUserId() || ''
      pcryptoService.value = new PcryptoService(keys, myUserId)
      localMessengerKeys.value = keys
    } catch (e) {
      console.error('[MessengerStore] Failed to init Pcrypto:', e)
    }
  }

  const waitForPcrypto = async (timeoutMs = 5000) => {
    if (pcryptoService.value) return true

    const startedAt = Date.now()

    while (!pcryptoService.value && Date.now() - startedAt < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return !!pcryptoService.value
  }

  const getPartnerMatrixId = (room: any): string | null => {
    if (!room) return null

    const myUserId = matrixService.getClient()?.getUserId()
    let otherMember = room.getJoinedMembers?.().find((m: any) => m.userId !== myUserId)

    if (!otherMember && room.currentState?.getMembers) {
      const allMembers = room.currentState.getMembers()
      otherMember = allMembers.find((m: any) => m.userId !== myUserId && (m.membership === 'join' || m.membership === 'invite'))
    }

    return otherMember ? otherMember.userId : room.roomId || null
  }

  const mapRoomToDialog = async (room: any): Promise<Dialog> => {
    if (room?.loadMembersIfNeeded) {
      try {
        await room.loadMembersIfNeeded()
      } catch (e) {}
    }

    const timelineEvents = getRoomTimelineEvents(room)

    const myUserId = matrixService.getClient()?.getUserId()

    // Check if it's a DM (2 people) or Group
    // If it's a DM, we want the other person's name/avatar
    // If it's a group, we want the room name and room avatar (or generated from name)

    const joinedMembers = room.getJoinedMembers()
    const isDirect = joinedMembers.length === 2

    let otherMember = joinedMembers.find((m: any) => m.userId !== myUserId)

    if (!otherMember) {
      const allMembers = room.currentState.getMembers()
      otherMember = allMembers.find((m: any) => m.userId !== myUserId && (m.membership === 'join' || m.membership === 'invite'))
    }

    const roomName = room.name || (otherMember ? otherMember.name : 'Чат')

    const partnerId = isDirect ? (otherMember ? otherMember.userId : room.roomId) : null
    const member = partnerId && room.getMember ? room.getMember(partnerId) : null

    // Fallback avatar handling
    let avatarUrl = undefined

    // 1. If Group, prioritize room avatar
    if (!isDirect) {
        if (room.getAvatarUrl) {
            avatarUrl = room.getAvatarUrl(matrixService.getBaseUrl(), 40, 40, 'crop')
        }
    }

    // 2. If DM or no room avatar, try member avatar
    if (!avatarUrl && member?.getAvatarUrl) {
      avatarUrl = member.getAvatarUrl(matrixService.getBaseUrl(), 40, 40, 'crop')
    }
    if (!avatarUrl && member?.avatarUrl) {
      avatarUrl = getMatrixAvatarUrl(member.avatarUrl, 40)
    }

    // 3. Fallback to room avatar if not checked yet
    if (!avatarUrl && isDirect && room.getAvatarUrl) {
      avatarUrl = room.getAvatarUrl(matrixService.getBaseUrl(), 40, 40, 'crop')
    }

    if (!avatarUrl && otherMember?.getAvatarUrl) {
      avatarUrl = otherMember.getAvatarUrl(matrixService.getBaseUrl(), 40, 40, 'crop')
    }
    if (!avatarUrl && otherMember?.avatarUrl) {
      avatarUrl = getMatrixAvatarUrl(otherMember.avatarUrl, 40)
    }

    // Profile lookup
    let name = roomName
    if (isDirect && member?.name) name = member.name

    let avatar = avatarUrl

    // If we have a partner (DM), try to get their profile from our cache
    let verified = false
    if (partnerId) {
      const address = getAddressFromMatrixId(partnerId)
      if (address) {
        if (!userProfiles.value[address]) {
          fetchProfiles([address])
        }
        const p = userProfiles.value[address]
        if (p?.name) name = p.name
        const img = p?.i || (p as any)?.avatar || (p as any)?.image
        if (img) {
          const url = getAvatarUrl(img)
          if (url) avatar = url
        }
        const badges = (p as any)?.badges
        if (Array.isArray(badges)) {
          verified = badges.includes('verificated') ||
            badges.includes('verified')
        }
        if (!verified) {
          const flags = (p as any)?.flags
          const real = (flags && (flags as any).real) ?? (p as any)?.real
          verified = real === 1 || real === '1' || real === true || real === 'true'
        }
      }
    }

    if (!avatar && partnerId) {
      const client = matrixService.getClient()
      if (client?.getProfileInfo) {
        try {
          const profile = await client.getProfileInfo(partnerId)
          const matrixAvatar = getMatrixAvatarUrl(profile?.avatar_url, 40)
          if (matrixAvatar) avatar = matrixAvatar
          if (profile?.displayname && !name) name = profile.displayname
        } catch (e) {}
      }
    }

    // If still no avatar, we need to generate initials in the component
    // We pass the name, and the component should handle initials if avatar is null

    ensurePcryptoInitialized()
    if (!pcryptoService.value && isInitInProgress.value) {
      await waitForPcrypto(1500)
    }

    let lastMessage: Message | undefined = undefined
    for (let i = timelineEvents.length - 1; i >= 0; i -= 1) {
      const mapped = await mapEventToMessage(timelineEvents[i], false)
      if (mapped) {
        lastMessage = mapped
        break
      }
    }

    const createdAt = timelineEvents.length
      ? Math.min(...timelineEvents.map((e: any) => getEventTs(e)))
      : undefined

    if (activeChatId.value === room.roomId) {
      return {
        id: room.roomId,
        partner: {
          id: partnerId || room.roomId,
          name: name,
          avatar: avatar,
          verified: verified
        },
        unreadCount: 0,
        lastMessage: lastMessage,
        createdAt
      }
    }

    // Try multiple properties for unread count
    let unreadCount = room.getUnreadNotificationCount('total')
    if (typeof unreadCount !== 'number') {
      unreadCount = room.getUnreadNotificationCount('ns.total')
    }

    return {
      id: room.roomId,
      partner: {
        id: partnerId || room.roomId,
        name: name,
        avatar: avatar,
        verified: verified
      },
      unreadCount: unreadCount || 0,
      lastMessage: lastMessage,
      createdAt
    }
  }

  const loadDialogs = async (silent = false) => {
    if (!silent) isLoading.value = true
    try {
      const rooms = matrixService.getRooms()
      const partnerAddresses = rooms
        .map((room: any) => getPartnerMatrixId(room))
        .map((id: string | null) => (id ? getAddressFromMatrixId(id) : null))
        .filter((address: string | null): address is string => Boolean(address))
      if (partnerAddresses.length > 0) {
        await fetchProfiles(Array.from(new Set(partnerAddresses)))
      }

      let dialogsList = await Promise.all(rooms.map(mapRoomToDialog))

      // Сохраняем имя/аватар из уже имеющегося диалога, если из Matrix пришло пусто («Empty Room»)
      const prevDialogs = dialogs.value
      dialogsList = dialogsList.map((d: Dialog) => {
        const prev = prevDialogs.find((p: Dialog) => p.id === d.id)
        if (!prev?.partner) return d
        const name = d.partner?.name?.trim()
        const avatar = d.partner?.avatar
        if ((!name || name === 'Empty Room' || name === 'Unknown') && (prev.partner.name || prev.partner.avatar)) {
          return {
            ...d,
            partner: {
              ...d.partner,
              name: prev.partner.name || d.partner?.name,
              avatar: prev.partner.avatar ?? d.partner?.avatar
            }
          }
        }
        return d
      })

      // Комната после createRoom попадает в getRooms() только после синка. Если сейчас открыт чат,
      // которого ещё нет в списке — сохраняем его в списке, чтобы чат не пропадал.
      const activeId = activeChatId.value
      if (activeId && !dialogsList.some((d: Dialog) => d.id === activeId)) {
        const existing = dialogs.value.find((d: Dialog) => d.id === activeId)
        if (existing) {
          dialogsList = [existing, ...dialogsList]
        }
      }

      dialogsList.forEach((d: Dialog) => {
        const url = d.partner.avatar
      })

      // Сортировка по времени: последнее сообщение или время создания комнаты — один временной ряд
      dialogs.value = dialogsList.sort((a: Dialog, b: Dialog) => {
        const tsA = a.lastMessage?.timestamp ?? a.createdAt ?? 0
        const tsB = b.lastMessage?.timestamp ?? b.createdAt ?? 0
        return tsB - tsA
      })
    } catch (e) {
      console.error('[MessengerStore] Failed to load dialogs:', e)
    } finally {
      if (!silent) isLoading.value = false
      if (syncState.value === 'PREPARED' || syncState.value === 'SYNCING') {
        dialogsLoadedOnce.value = true
      }
    }
  }

  const loadMessages = async (chatId: string) => {
    activeChatId.value = chatId
    isMessagesLoading.value = true
    try {
      ensurePcryptoInitialized()
      if (!pcryptoService.value && isInitInProgress.value) {
        await waitForPcrypto()
      }
      const room = matrixService.getRoom(chatId)
      if (room) {
        // Ensure members are loaded
        await room.loadMembersIfNeeded()

        await paginateRoomHistory(room)

        const timelineEvents = getRoomTimelineEvents(room)
        const mapped = await Promise.all(timelineEvents.map((e: any) => mapEventToMessage(e)))
        messages.value[chatId] = mapped.filter((m): m is Message => Boolean(m))
      }
    } catch (e) {
      console.error('[MessengerStore] Failed to load messages:', e)
    } finally {
      isMessagesLoading.value = false
    }
  }

  const sendMessage = async (chatId: string, text: string) => {
    try {
      await matrixService.sendMessage(chatId, text)
      // Optimistic update or wait for sync?
      // Matrix SDK handles sync
    } catch (e) {
      console.error('[MessengerStore] Failed to send message:', e)
    }
  }

  const sendAudio = async (chatId: string, blob: Blob, meta?: { duration?: number; name?: string }) => {
    try {
      const client = matrixService.getClient()
      if (!client) throw new Error('Matrix client not initialized')

      ensurePcryptoInitialized()
      if (!pcryptoService.value && isInitInProgress.value) {
        await waitForPcrypto()
      }
      const room = matrixService.getRoom(chatId)
      if (!room) throw new Error('Room not found')
      await room.loadMembersIfNeeded?.()

      const objectUrl = URL.createObjectURL(blob)
      const tempId = 'local-' + Math.random().toString(36).slice(2)
      const now = Date.now()

      const tempMessage: Message = {
        id: tempId,
        chatId,
        senderId: currentUser.value.id,
        senderName: currentUser.value.name,
        text: '',
        type: 'audio',
        url: objectUrl,
        info: {
          mimetype: (blob as any).type || 'audio/webm',
          size: blob.size,
          duration: meta?.duration || 0,
          uploadProgress: 0
        },
        rawContent: null,
        timestamp: now,
        read: true,
        status: 'sending'
      }

      if (!messages.value[chatId]) messages.value[chatId] = []
      messages.value[chatId].push(tempMessage)

      const onProgress = (loaded: number, total?: number) => {
        const msg = messages.value[chatId]?.find(m => m.id === tempId)
        if (msg && msg.info) {
          const percent = total ? Math.min(100, Math.round((loaded / total) * 100)) : Math.min(100, Math.round((loaded / (msg.info.size || loaded)) * 100))
          msg.info.uploadProgress = percent
        }
      }

      const memberIds = getOrderedMemberIds(room, now)
      const addressesToFetch: string[] = []
      for (const memberId of memberIds) {
        const address = getAddressFromMatrixId(memberId)
        if (address && !userProfiles.value[address]) addressesToFetch.push(address)
      }
      if (addressesToFetch.length > 0) await fetchProfiles(addressesToFetch)

      const users: PcryptoUser[] = []
      const myMatrixId = matrixService.getClient()?.getUserId()
      for (const memberId of memberIds) {
        const address = getAddressFromMatrixId(memberId)
        const isMe = !!myMatrixId && memberId === myMatrixId
        if (isMe) {
          if (address && userProfiles.value[address]?.k) {
            users.push({
              id: memberId,
              keys: parseProfileKeys(userProfiles.value[address].k),
              dbId: (userProfiles.value[address] as any).id
            })
            continue
          }
          if (localMessengerKeys.value) {
            users.push({
              id: memberId,
              keys: localMessengerKeys.value.map(k => k.public),
              dbId: address && userProfiles.value[address] ? (userProfiles.value[address] as any).id : undefined
            })
            continue
          }
        }
        if (address && userProfiles.value[address]?.k) {
          users.push({
            id: memberId,
            keys: parseProfileKeys(userProfiles.value[address].k),
            dbId: (userProfiles.value[address] as any).id
          })
        }
      }

      const isDirect = isTetatetchat(room)
      let block = 0
      if (isDirect) {
        block = 10
      } else {
        const b = await getCurrentBlockHeight()
        block = b || 10
      }

      const enc = new TextEncoder()
      const rand = crypto.getRandomValues(new Uint8Array(32))
      const secretStr = Array.from(rand).map(b => b.toString(16).padStart(2, '0')).join('')
      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(secretStr),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
      )
      const derivedKey = await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: enc.encode('matrix.pocketnet'),
          iterations: 10000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-CBC', length: 256 },
        true,
        ['encrypt', 'decrypt']
      )
      const iv = new Uint8Array([19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34])
      const plainBuffer = await blob.arrayBuffer()
      const cipherBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-CBC', iv },
        derivedKey,
        plainBuffer
      )
      const encryptedBlob = new Blob([cipherBuffer], { type: 'application/octet-stream' })

      const version = 2
      const secrets = await pcryptoService.value!.encryptKey(secretStr, users, block, version)

      await matrixService.sendAudio(
        chatId,
        {
          blob: encryptedBlob,
          name: meta?.name || 'voice-message',
          mimetype: (blob as any).type || 'audio/webm',
          duration: meta?.duration || 0,
          size: encryptedBlob.size,
          secrets,
          block
        },
        onProgress
      )

      const idx = messages.value[chatId]?.findIndex(m => m.id === tempId)
      if (typeof idx === 'number' && idx >= 0) {
        messages.value[chatId].splice(idx, 1)
      }

      try {
        URL.revokeObjectURL(objectUrl)
      } catch (_e) {}
    } catch (e) {
      console.error('[MessengerStore] Failed to send audio:', e)
      // Mark temp message failed
      const arr = messages.value[chatId]
      if (arr) {
        const last = arr[arr.length - 1]
        if (last && last.status === 'sending' && last.type === 'audio') {
          last.status = 'failed'
        }
      }
    }
  }

  const initMatrix = async () => {
    // 1. Ensure Auth
    if (!authStore.isUserAuthenticated || !authStore.address || !authStore.keyPair) {
      console.warn('[MessengerStore] Cannot init Matrix: User not authenticated')
      return
    }

    if (isInitInProgress.value) return
    isInitInProgress.value = true

    try {
      // 2. Start Matrix client if needed
      if (!matrixService.getClient()) {
        isLoading.value = true
        try {
          // Listen to matrix events
          matrixService.on('Room.timeline', async (event: any, room: any, toStartOfTimeline: boolean) => {
             if (toStartOfTimeline) return

             try {
                const type = getEventType(event)
                if (isRenderableMessageEvent(event)) {
                  const roomId = getEventRoomId(event)

                  // Ensure currentUser id is set
                  if (currentUser.value.id === 'me') {
                      const client = matrixService.getClient()
                      if (client) currentUser.value.id = client.getUserId() || 'me'
                  }

                  // Play sound if message is not from me and not in active chat
                  const senderId = getEventSender(event)
                  const myId = currentUser.value.id
                  // Only play sound for recent messages (less than 60 seconds old)
                  const isRecent = (Date.now() - getEventTs(event)) < 60000

                  if (senderId !== myId && activeChatId.value !== roomId && isRecent) {
                    try {
                      const audio = new Audio(glassSound)
                      audio.play().catch(e => console.error('[MessengerStore] Failed to play sound:', e))
                    } catch (e) {
                      console.error('[MessengerStore] Failed to init audio:', e)
                    }
                  }

                  // If this is the active chat, append message
                  if (activeChatId.value === roomId) {
                    const msg = await mapEventToMessage(event)

                    if (!msg) {
                      console.warn('[MessengerStore] mapEventToMessage returned null for event:', event.getId())
                      return
                    }

                    if (!messages.value[roomId]) messages.value[roomId] = []
                    // Check duplicate
                    if (!messages.value[roomId].find(m => m.id === msg.id)) {
                      messages.value[roomId].push(msg)
                      // Force scroll to bottom if needed? MessageList watches messages and handles it.
                    }

                    // Mark as read immediately if active
                    try {
                      const client = matrixService.getClient()
                      const evId = (typeof event.getId === 'function') ? event.getId() : getEventId(event)
                      if (client && typeof evId === 'string' && evId.startsWith('$')) {
                        if (typeof client.setRoomReadMarkers === 'function') {
                          await client.setRoomReadMarkers(room.roomId, evId, event)
                        } else if (typeof client.sendReadReceipt === 'function') {
                          await client.sendReadReceipt(event)
                        }
                      }
                    } catch (e) {
                        console.warn('[MessengerStore] Failed to send read receipt', e)
                    }
                  }

                  // Refresh dialogs to show new last message/unread count
                  loadDialogs(true)
                }
             } catch (e) {
                 console.error('[MessengerStore] Error in Room.timeline listener:', e)
             }
          })

          // Monitor sync state — список показываем только после PREPARED и одной загрузки, чтобы не было прыжков UI
          matrixService.on('sync', (state: string, prevState: string, data: any) => {
              syncState.value = state
              if (state === 'ERROR') {
                  syncError.value = 'Sync Error'
              } else if (state === 'PREPARED') {
                  syncError.value = null
                  loadDialogs(true).then(() => {
                    dialogsLoadedOnce.value = true
                  })
              }
          })

          const success = await matrixService.login(authStore.address, authStore.keyPair)
          if (!success) {
             throw new Error('Matrix login failed')
          }

          await syncCurrentUser()

        } catch (e) {
          console.error('[MessengerStore] Failed to init Matrix:', e)
        } finally {
          isLoading.value = false
        }
      }

      await syncCurrentUser()
      ensurePcryptoInitialized()

      // 4. Load dialogs if needed
      if (dialogs.value.length === 0 && matrixService.getClient()) {
          await loadDialogs()
      }
    } finally {
      isInitInProgress.value = false
    }
  }

  const openChat = async (chatId: string) => {
    inviteViewActive.value = false
    lastTargetAddress.value = null
    activeChatId.value = chatId

    // Reset unread count for this chat
    const dialogIndex = dialogs.value.findIndex(d => d.id === chatId)
    if (dialogIndex !== -1) {
      dialogs.value[dialogIndex].unreadCount = 0
    }

    await loadMessages(chatId)

    // Send read receipt to Matrix server
    try {
      const room = matrixService.getRoom(chatId)
      if (room) {
        const events = room.getLiveTimeline().getEvents()
        if (events && events.length > 0) {
           // Find last event with a valid ID (remote)
           const lastEvent = [...events].reverse().find(e => e.getId() && e.getId().startsWith('$'))
           if (lastEvent) {
               // Use setRoomReadMarkers instead of sendReadReceipt to avoid 500 error on some servers
               // This updates both the 'fully read' marker and the read receipt
               const client = matrixService.getClient()
               if (client && typeof client.setRoomReadMarkers === 'function') {
                   await client.setRoomReadMarkers(room.roomId, lastEvent.getId(), lastEvent)
               } else {
                   await client?.sendReadReceipt(lastEvent)
               }
           }
        }
      }
    } catch (e) {
      console.warn('[MessengerStore] Failed to send read receipt', e)
    }
  }

  const toggleMessenger = async () => {
    isOpen.value = !isOpen.value

    if (isOpen.value) {
      const needDialogs = dialogs.value.length === 0
      if (needDialogs) isLoading.value = true
      try {
        if (!matrixService.getClient()) {
          await initMatrix()
        }
        if (needDialogs) {
          await loadDialogs()
        }
      } finally {
        if (needDialogs) isLoading.value = false
      }
    }
  }

  const openMessenger = async () => {
    if (!isOpen.value) {
      await toggleMessenger()
    } else {
      const needDialogs = dialogs.value.length === 0
      if (needDialogs) isLoading.value = true
      try {
        if (!matrixService.getClient()) {
          await initMatrix()
        }
        if (needDialogs) {
          await loadDialogs()
        }
      } finally {
        if (needDialogs) isLoading.value = false
      }
    }
  }

  const activeMessages = computed(() => {
    if (!activeChatId.value) return []
    return messages.value[activeChatId.value] || []
  })

  const activeDialog = computed<Dialog | null>(() => {
    if (!activeChatId.value) return null
    return dialogs.value.find(d => d.id === activeChatId.value) || null
  })

  const totalUnreadCount = computed(() => {
    return dialogs.value.reduce((sum, dialog) => sum + (dialog.unreadCount || 0), 0)
  })

  // Watch for profile updates to refresh dialog list (names/avatars)
  let profileUpdateTimeout: any = null
  watch(() => userProfiles.value, () => {
    if (profileUpdateTimeout) clearTimeout(profileUpdateTimeout)
    profileUpdateTimeout = setTimeout(() => {
      loadDialogs(true)
    }, 500)
  }, { deep: true })

  /**
   * Находит или создаёт комнату с пользователем, добавляет оптимистичный диалог.
   * Возвращает roomId. Переключение на чат (activeChatId/lastTargetAddress) делает вызывающий код — так Vue успевает перерисовать за один клик.
   */
  const startChatWithAddress = async (address: string): Promise<string | null> => {
    if (!address) return null
    if (!authStore.isUserAuthenticated) return null
    lastTargetAddress.value = address
    try {
      await fetchProfiles([address])
    } catch (_e) {}
    await openMessenger()
    await initMatrix()
    const hex = matrixService.addressToHex(address).toLowerCase()
    let host = 'matrix.bastyon.com'
    try {
      const base = matrixService.getBaseUrl()
      const parsed = new URL(base.startsWith('http') ? base : window.location.origin)
      const h = parsed.host || window.location.host
      host = (h.includes('localhost') || h.startsWith('127.')) ? 'matrix.pocketnet.app' : h
    } catch (_e) {
      const h = window.location.host
      host = (h.includes('localhost') || h.startsWith('127.')) ? 'matrix.pocketnet.app' : h
    }
    const partnerId = `@${hex}:${host}`
    const rooms = matrixService.getRooms()
    let roomId: string | null = null
    for (const room of rooms) {
      const pid = getPartnerMatrixId(room)
      if (pid === partnerId) {
        roomId = room.roomId
        break
      }
    }
    if (!roomId) {
      roomId = await matrixService.createDirectRoom(partnerId)
      if (roomId) {
        const profile = userProfiles.value[address]
        const partnerName = profile?.name || address || ''
        let partnerAvatar: string | undefined
        if (profile && ((profile as any).i || (profile as any).avatar)) {
          const img = (profile as any).i || (profile as any).avatar
          if (img.startsWith('http')) partnerAvatar = img
          else partnerAvatar = `https://pocketnet.app:8092/i/${img}`
        }
        const optimisticDialog: Dialog = {
          id: roomId,
          partner: {
            id: partnerId,
            name: partnerName,
            avatar: partnerAvatar,
            verified: false
          },
          unreadCount: 0,
          lastMessage: undefined,
          createdAt: Date.now()
        }
        dialogs.value = [optimisticDialog, ...dialogs.value]
      }
    }
    if (!roomId) {
      console.warn('[MessengerStore] startChatWithAddress: failed to create/open room')
      return null
    }
    return roomId
  }

  const switchToChatAndLoad = (roomId: string): void => {
    inviteViewActive.value = false
    lastTargetAddress.value = null
    activeChatId.value = roomId
    const dialogIndex = dialogs.value.findIndex(d => d.id === roomId)
    if (dialogIndex !== -1) {
      dialogs.value[dialogIndex].unreadCount = 0
    }
    Promise.resolve().then(async () => {
      await loadMessages(roomId)
      await loadDialogs(true)
      try {
        const room = matrixService.getRoom(roomId)
        if (room) {
          const events = room.getLiveTimeline().getEvents()
          if (events && events.length > 0) {
            const lastEvent = [...events].reverse().find((e: any) => e.getId() && e.getId().startsWith('$'))
            if (lastEvent) {
              const client = matrixService.getClient()
              if (client && typeof client.setRoomReadMarkers === 'function') {
                await client.setRoomReadMarkers(room.roomId, lastEvent.getId(), lastEvent)
              } else {
                await client?.sendReadReceipt(lastEvent)
              }
            }
          }
        }
      } catch (_e) {}
    })
  }

  const openInviteWithAddress = async (address: string, preloadedProfile?: UserProfile | null): Promise<void> => {
    if (!address) return
    if (!authStore.isUserAuthenticated) return
    lastTargetAddress.value = address
    inviteViewActive.value = true
    // Если передан уже загруженный профиль (например из сайдбара страницы профиля) — используем его, без повторного запроса
    if (preloadedProfile && preloadedProfile.address === address) {
      userProfiles.value[address] = preloadedProfile
    }
    try {
      await fetchProfiles([address])
    } catch (_e) {}
    await openMessenger()
    // Do NOT create room yet; wait for user to press "Начать чат"
    activeChatId.value = null
  }

  const clearInviteTarget = (): void => {
    lastTargetAddress.value = null
    inviteViewActive.value = false
  }

  const decryptAudioData = async (blob: Blob, message: Message): Promise<Blob | null> => {
    if (!pcryptoService.value) return null
    if (!message.info?.secrets) return null

    try {
      const chatId = message.chatId
      const room = matrixService.getRoom(chatId)
      if (!room) return null

      const ts = message.timestamp
      const memberIds = getOrderedMemberIds(room, ts)

      const addressesToFetch: string[] = []
      for (const memberId of memberIds) {
          const address = getAddressFromMatrixId(memberId)
          if (address && !userProfiles.value[address]) addressesToFetch.push(address)
      }
      if (addressesToFetch.length > 0) await fetchProfiles(addressesToFetch)

      const users: PcryptoUser[] = []
      const myMatrixId = matrixService.getClient()?.getUserId()

      for (const memberId of memberIds) {
        const address = getAddressFromMatrixId(memberId)
        if (address && userProfiles.value[address]?.k) {
            users.push({
              id: memberId,
              keys: parseProfileKeys(userProfiles.value[address].k),
              dbId: userProfiles.value[address].id || 0
            })
        }
      }

      const fakeEvent = {
          sender: message.senderId,
          content: {
              info: { secrets: message.info.secrets }
          }
      }

      const decryptedSecretsStr = await pcryptoService.value.decryptEvent(fakeEvent, users)
      if (!decryptedSecretsStr) {
          console.error('[MessengerStore] decryptAudioData: decryptEvent returned null')
          return null
      }

      const arrayBuffer = await blob.arrayBuffer()

      // In bastyon-chat the decrypted key is a comma-separated numeric string.
      // It is used directly as the PBKDF2 input, and AES-CBC decrypts the file
      // with a fixed IV [19..34]. Replicate that behavior here.
      const secretStr = decryptedSecretsStr.trim()

      if (!secretStr) {
        console.error('[MessengerStore] decryptAudioData: empty secret string')
        return null
      }

      // Use proper AES-CBC decryption like the original bastyon-chat implementation
      const enc = new TextEncoder()

      // Derive key using PBKDF2 with proper salt and iterations
      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(secretStr),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
      )

      const derivedKey = await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: enc.encode('matrix.pocketnet'),
          iterations: 10000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-CBC', length: 256 },
        true,
        ['encrypt', 'decrypt']
      )

      // Use fixed IV identical to bastyon-chat PcryptoFile implementation
      const iv = new Uint8Array([19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34])

      // Check if data size is valid for AES-CBC (must be multiple of 16 bytes and at least 16 bytes)
      if (arrayBuffer.byteLength < 16) {
        console.error('[MessengerStore] decryptAudioData: Data too small for AES-CBC:', arrayBuffer.byteLength, 'bytes')
        return null
      }
      if (arrayBuffer.byteLength % 16 !== 0) {
        console.error('[MessengerStore] decryptAudioData: Invalid data size for AES-CBC (not multiple of 16):', arrayBuffer.byteLength, 'bytes')
        return null
      }

      // Decrypt using AES-CBC - ensure proper ArrayBuffer types
      const decryptedResult = await window.crypto.subtle.decrypt(
        {
          name: 'AES-CBC',
          iv: iv
        },
        derivedKey,
        arrayBuffer
      )

      const decryptedBytes = new Uint8Array(decryptedResult)
      const mime = detectAudioMime(decryptedBytes)

      return new Blob([decryptedBytes as unknown as BlobPart], { type: mime || 'audio/mpeg' })

    } catch (e) {
      console.error('[MessengerStore] decryptAudioData failed:', e)
      return null
    }
  }

  const logout = () => {
    matrixService.stop()
    isOpen.value = false
    isFullScreen.value = false
    activeChatId.value = null
    dialogs.value = []
    messages.value = {}
    currentUser.value = {
      id: 'me',
      name: 'Я',
      avatar: 'https://via.placeholder.com/150',
    }
    isSyncStarted.value = false
    isLoading.value = false
    syncState.value = 'STOPPED'
    syncError.value = null
    userProfiles.value = {}
    pcryptoService.value = null
    localMessengerKeys.value = null
    isInitInProgress.value = false
    dialogsLoadedOnce.value = false
  }

  return {
    isOpen,
    isFullScreen,
    activeChatId,
    dialogs,
    messages,
    activeMessages,
    activeDialog,
    currentUser,
    lastTargetAddress,
    inviteViewActive,
    isSyncStarted,
    isLoading,
    isMessagesLoading,
    dialogsLoadedOnce,
    syncState,
    syncError,
    userProfiles,
    pcryptoService,

    loadDialogs,
    loadMessages,
    loadMoreMessages,
    openChat,
    toggleMessenger,
    openMessenger,
    sendMessage,
    sendAudio,
    initMatrix,
    logout,
    fetchProfiles,
    totalUnreadCount,
    decryptAudioData,
    startChatWithAddress,
    switchToChatAndLoad,
    openInviteWithAddress,
    clearInviteTarget
  }
})
