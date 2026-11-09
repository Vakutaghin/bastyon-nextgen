<template>
  <Modal
    :open="store.isOpen"
    :width="600"
    :centered="true"
    :closable="!saving"
    :mask-closable="!saving"
    :z-index="2700"
    @cancel="close"
  >
    <template #title>{{ title }} <HelpLink topic="collections#create" /></template>
    <SC_ModalBody>
      <SC_Editor data-testid="collection-editor">
        <SC_Status v-if="loading">{{ t('collections.loading') }}</SC_Status>
        <template v-else>
          <template v-if="mode === 'create'">
            <SC_ChoiceBlock v-if="kindChoices.length > 1">
              <span id="list-kind-label" class="label">{{ t('lists.whatInside') }}</span>
              <SC_Choices role="radiogroup" aria-labelledby="list-kind-label">
                <SC_Choice
                  v-for="k in kindChoices"
                  :key="k"
                  type="button"
                  role="radio"
                  :aria-checked="kind === k"
                  :class="{ active: kind === k }"
                  :data-testid="`list-kind-${k}`"
                  @click="setKind(k)"
                >
                  <span class="icon"><component :is="KIND_ICONS[k]" /></span>
                  <span class="title">{{ t(`lists.kind.${k}`) }}</span>
                  <span class="hint">{{ t(`lists.kindHint.${k}`) }}</span>
                </SC_Choice>
              </SC_Choices>
            </SC_ChoiceBlock>
            <SC_ChoiceBlock v-if="!store.target?.lockVisibility">
              <span id="list-visibility-label" class="label">{{ t('lists.whoSees') }}</span>
              <SC_Choices role="radiogroup" aria-labelledby="list-visibility-label">
                <SC_Choice
                  v-for="v in VISIBILITIES"
                  :key="v"
                  type="button"
                  role="radio"
                  :aria-checked="visibility === v"
                  :class="{ active: visibility === v }"
                  :data-testid="`list-visibility-${v}`"
                  @click="visibility = v"
                >
                  <span class="icon">
                    <LockOutlined v-if="v === 'private'" />
                    <GlobalOutlined v-else />
                  </span>
                  <span class="title">{{ t(`lists.visibility.${v}`) }}</span>
                  <span class="hint">{{ t(`lists.visibilityHint.${v}`) }}</span>
                </SC_Choice>
              </SC_Choices>
            </SC_ChoiceBlock>
          </template>

          <SC_Field>
            <span class="label">{{ t('collections.editor.caption') }}</span>
            <input
              v-model="caption"
              :maxlength="COLLECTION_CAPTION_MAX"
              :placeholder="t(`collections.editor.captionPlaceholder.${kind}`)"
              data-testid="collection-caption"
            />
          </SC_Field>

          <template v-if="isPublic">
            <SC_Field>
              <span class="label">{{ t('collections.editor.description') }}</span>
              <textarea
                v-model="description"
                rows="3"
                :placeholder="t('collections.editor.descriptionPlaceholder')"
              />
              <span class="counter" :class="{ over: bytes > COLLECTION_MAX_PAYLOAD_BYTES }">
                {{ t('collections.editor.bytes', { n: bytes, max: COLLECTION_MAX_PAYLOAD_BYTES }) }}
              </span>
            </SC_Field>

            <SC_CoverRow>
              <SC_CoverPreview :class="{ square: kind === 'audio' }">
                <img v-if="coverShown" :src="coverShown" alt="" />
                <CollectionIcon v-else />
              </SC_CoverPreview>
              <div class="cover-text">
                <span class="label">{{ t('collections.editor.cover') }}</span>
                <span class="hint">
                  {{
                    customImage
                      ? t('collections.editor.coverCustom')
                      : t('collections.editor.coverAuto')
                  }}
                </span>
                <div class="cover-actions">
                  <Button size="small" :loading="uploading" @click="pickCover">
                    {{ t('collections.editor.coverUpload') }}
                  </Button>
                  <Button v-if="customImage" size="small" @click="customImage = ''">
                    {{ t('collections.editor.coverReset') }}
                  </Button>
                </div>
                <input ref="fileInput" type="file" accept="image/*" hidden @change="onCoverFile" />
              </div>
            </SC_CoverRow>
          </template>

          <SC_ItemsHead>
            <span class="label">{{ t(`collections.editor.items.${kind}`) }}</span>
            <span class="count" :class="{ over: ids.length > maxItems }">
              {{ ids.length }} / {{ maxItems }}
            </span>
          </SC_ItemsHead>
          <SC_Items ref="listRef">
            <SC_Item
              v-for="(id, index) in ids"
              :key="id"
              :class="{ dragging: dragIndex === index }"
            >
              <SC_Handle
                type="button"
                :aria-label="t('collections.editor.move', { n: index + 1 })"
                @pointerdown="onPointerDown($event, index)"
                @keydown="onHandleKey($event, index)"
              >
                <DragHandleIcon />
              </SC_Handle>
              <span class="num">{{ index + 1 }}</span>
              <span class="title" :class="{ gone: posts.get(id) === null }">
                {{ itemTitle(id) }}
              </span>
              <SC_Remove
                type="button"
                :aria-label="t('collections.editor.remove')"
                @click="removeAt(index)"
              >
                <CloseOutlined />
              </SC_Remove>
            </SC_Item>
          </SC_Items>
          <SC_Status v-if="!ids.length">{{ t(`lists.emptyItems.${kind}`) }}</SC_Status>

          <SC_ItemsHead>
            <span class="label">{{ t('lists.addFrom') }}</span>
            <SC_PickTabs v-if="pickSources.length > 1" role="tablist">
              <button
                v-for="src in pickSources"
                :key="src"
                type="button"
                role="tab"
                :aria-selected="pickSource === src"
                :class="{ active: pickSource === src }"
                :data-testid="`list-pick-${src}`"
                @click="pickSource = src"
              >
                {{
                  src === 'own' ? t(`collections.editor.addOwn.${kind}`) : t('library.favorites')
                }}
              </button>
            </SC_PickTabs>
            <span v-else class="count">{{ t('library.favorites') }}</span>
          </SC_ItemsHead>
          <SC_Picker data-testid="list-picker">
            <li v-for="post in pickPosts" :key="postId(post)">
              <SC_PickRow
                type="button"
                :class="{ on: ids.includes(postId(post)) }"
                :disabled="!ids.includes(postId(post)) && ids.length >= maxItems"
                @click="togglePick(post)"
              >
                <CheckOutlined v-if="ids.includes(postId(post))" />
                <PlusOutlined v-else />
                <span>{{ mediaTitle(post) || t('media.untitled') }}</span>
              </SC_PickRow>
            </li>
            <li v-if="pickHasMore && !pickLoading">
              <SC_PickRow type="button" class="more" @click="pickMore">
                {{ t('collections.editor.showMore') }}
              </SC_PickRow>
            </li>
          </SC_Picker>
          <SC_Status v-if="pickLoading">{{ t('collections.loading') }}</SC_Status>
          <SC_Status v-else-if="!pickPosts.length">{{ pickEmptyText }}</SC_Status>

          <SC_Note>{{ noteText }}</SC_Note>
          <SC_Error v-if="errorText" role="alert">{{ errorText }}</SC_Error>
        </template>
      </SC_Editor>
    </SC_ModalBody>

    <template #footer>
      <SC_ModalActions>
        <Button :disabled="saving" @click="close">{{ t('collections.cancel') }}</Button>
        <Button
          type="primary"
          :loading="saving"
          :disabled="!canSave"
          data-testid="collection-save"
          @click="save"
        >
          {{ saveLabel }}
        </Button>
      </SC_ModalActions>
    </template>
  </Modal>
</template>

<script setup lang="ts">
// Окно «Создать» и правка своей публичной коллекции.
//
// Новый список: «Что внутри» (видео, аудио, публикации) и «Кто видит» (только
// я — личный список в данных аккаунта, все — коллекция в блокчейне). Личный
// создаётся сразу; публичный уходит в сеть одной транзакцией, поэтому всё
// собирается здесь, по «Создать». Записи добавляются из «Избранного» и, у
// плейлиста, из своих роликов или треков.
//
// Правки в блокчейне ограничены (5 в месяц на коллекцию): всё меняется здесь и
// уходит одной транзакцией по «Сохранить». Обложка по умолчанию — превью
// первого элемента.

import { computed, ref, shallowRef, watch, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Button, Modal } from 'ant-design-vue'
import {
  AudioPlaylistIcon,
  CheckOutlined,
  CloseOutlined,
  CollectionIcon,
  DragHandleIcon,
  GlobalOutlined,
  LockOutlined,
  PlusOutlined,
  VideoPlaylistIcon,
} from '@/components/icons'
import { SC_ModalActions, SC_ModalBody } from '@/components/modal'
import { appToast } from '@/b-components/app-toast'
import HelpLink from '@/b-components/help/help-link.vue'
import { useAuthStore } from '@/blockchain'
import { useUIStore } from '@/stores/ui-store'
import { useCollectionEditorStore, type ListVisibility } from '@/stores/collection-editor-store'
import { AUTO_COVER_KEY, draftOf, type CollectionView } from '@/stores/collections-store'
import { useMediaLibrary } from '@/composables/use-media-library'
import { useMediaFeed, type MediaFeedSource } from '@/composables/use-media-feed'
import { useLibraryList } from '@/composables/use-library-list'
import { fetchCollectionItems } from '@/services/collections/collections-api'
import {
  COLLECTION_CAPTION_MAX,
  COLLECTION_EDIT_LIMIT,
  COLLECTION_MAX_ITEMS,
  COLLECTION_MAX_PAYLOAD_BYTES,
  collectionPayload,
  collectionPayloadBytes,
  validateCollectionDraft,
  type CollectionDraft,
  type CollectionKind,
} from '@/services/collections/collection-model'
import { FAVORITES, LIBRARY_LIST_MAX } from '@/services/media-library/media-library-doc'
import { fetchMediaInfo } from '@/services/media/media-info'
import { mediaCover, mediaTitle, mediaTypeOf, postId } from '@/services/media/media-post'
import { fileToBase64, resizeImageBase64 } from '@/helpers/common/resize-image'
import { uploadImage } from '@/services/image-upload-service'
import type { AdaptedPost } from '@/types/adapted-post'
import { usePointerReorder } from './use-pointer-reorder'
import {
  SC_ChoiceBlock,
  SC_Choice,
  SC_Choices,
  SC_CoverPreview,
  SC_CoverRow,
  SC_Editor,
  SC_Error,
  SC_Field,
  SC_Handle,
  SC_Item,
  SC_Items,
  SC_ItemsHead,
  SC_Note,
  SC_PickRow,
  SC_PickTabs,
  SC_Picker,
  SC_Remove,
  SC_Status,
} from './collection-editor-modal.styled'

const ALL_KINDS: readonly CollectionKind[] = ['video', 'audio', 'posts']
const VISIBILITIES: readonly ListVisibility[] = ['private', 'public']
const KIND_ICONS: Record<CollectionKind, Component> = {
  video: VideoPlaylistIcon,
  audio: AudioPlaylistIcon,
  posts: CollectionIcon,
}

const { t } = useI18n()
const router = useRouter()
const store = useCollectionEditorStore()
const authStore = useAuthStore()
const uiStore = useUIStore()
const { library, collections } = useMediaLibrary()

const mode = computed(() => store.target?.mode ?? 'create')
const chosenKind = ref<CollectionKind>('posts')
const visibility = ref<ListVisibility>('private')
const kind = computed<CollectionKind>(() =>
  mode.value === 'edit' ? (store.target?.kind ?? 'posts') : chosenKind.value
)
const kindChoices = computed(() => store.target?.kinds ?? ALL_KINDS)
/** Публичная: правка своей коллекции или новый список «для всех». */
const isPublic = computed(() => mode.value === 'edit' || visibility.value === 'public')
const maxItems = computed(() => (isPublic.value ? COLLECTION_MAX_ITEMS : LIBRARY_LIST_MAX))

const title = computed(() => {
  if (mode.value === 'edit') return t(`collections.editor.editTitle.${kind.value}`)
  return store.target?.replaces ? t('lists.makePublicTitle') : t('lists.createTitle')
})

const loading = ref(false)
const saving = ref(false)
const uploading = ref(false)
const errorText = ref('')
const caption = ref('')
const description = ref('')
/** Своя обложка; пусто — автоматическая. */
const customImage = ref('')
const ids = ref<string[]>([])
const posts = shallowRef<Map<string, AdaptedPost | null>>(new Map())
const autoCover = ref<string | null>(null)
let original: CollectionView | null = null

/** Подходит ли запись спискам этого типа: у публикаций — любая. */
function fits(post: AdaptedPost | null | undefined, k: CollectionKind): boolean {
  return k === 'posts' || !post || mediaTypeOf(post) === k
}

function setKind(k: CollectionKind): void {
  if (k === chosenKind.value) return
  chosenKind.value = k
  // Ролики не попадут в аудиоплейлист и наоборот: выбранное другого типа убираем.
  ids.value = ids.value.filter((id) => fits(posts.value.get(id), k))
  pickSource.value = defaultSource(k)
}

// --- Открытие ---

watch(
  () => store.seq,
  async () => {
    const target = store.target
    if (!target) return
    errorText.value = ''
    original = null
    chosenKind.value = target.kind
    visibility.value = target.visibility ?? 'private'
    caption.value = target.caption ?? ''
    description.value = ''
    customImage.value = ''
    ids.value = [...(target.initialIds ?? [])]
    posts.value = new Map()
    pickSource.value = defaultSource(target.kind)
    if (target.mode === 'edit' && target.rootTxid) {
      loading.value = true
      try {
        const result = await collections.loadCollection(target.rootTxid)
        if (!result) throw new Error('not found')
        original = result.collection
        caption.value = original.caption
        description.value = original.description
        const auto = original.settings[AUTO_COVER_KEY]
        customImage.value = original.image && original.image !== auto ? original.image : ''
        ids.value = [...original.contentIds]
        const map = new Map<string, AdaptedPost | null>()
        original.contentIds.forEach((id, i) => map.set(id, result.items[i] ?? null))
        posts.value = map
      } catch {
        errorText.value = t('collections.loadFailed')
      } finally {
        loading.value = false
      }
    }
  }
)

// Названия новых элементов — по мере добавления.
watch(ids, async (list) => {
  const missing = list.filter((id) => !posts.value.has(id))
  if (!missing.length) return
  const found = await fetchCollectionItems(missing).catch(() => [])
  const map = new Map(posts.value)
  missing.forEach((id, i) => map.set(id, found[i] ?? null))
  posts.value = map
})

// Обложка по умолчанию — превью первого доступного элемента.
watch(
  () => ids.value.find((id) => posts.value.get(id)),
  async (firstId) => {
    const first = firstId ? posts.value.get(firstId) : null
    if (!first) {
      autoCover.value = null
      return
    }
    if (!mediaTypeOf(first)) {
      autoCover.value = first.images[0] ?? null
      return
    }
    const info = await fetchMediaInfo([first.videoUrl!])
    autoCover.value = mediaCover(first, info.get(first.videoUrl!))
  }
)

const coverShown = computed(() => customImage.value || autoCover.value)

// --- Откуда добавлять: «Избранное» и свои ролики или треки ---

type PickSource = 'own' | 'favorites'

const me = computed(() => authStore.getUserAddress || '')
const pickSource = ref<PickSource>('favorites')
const pickSources = computed<PickSource[]>(() =>
  kind.value === 'posts' ? ['favorites'] : ['own', 'favorites']
)

/** У плейлиста сначала свои записи — так собирают свой альбом или сериал. */
function defaultSource(k: CollectionKind): PickSource {
  return k === 'posts' ? 'favorites' : 'own'
}

// Окно одно на приложение, а тип меняется от открытия к открытию: по ленте на тип.
const ownEnabled = (k: 'video' | 'audio') =>
  computed(() => store.isOpen && kind.value === k && pickSource.value === 'own' && !!me.value)
const ownFeeds = {
  video: useMediaFeed({
    type: 'video',
    source: ref<MediaFeedSource>('author'),
    author: me,
    enabled: ownEnabled('video'),
  }),
  audio: useMediaFeed({
    type: 'audio',
    source: ref<MediaFeedSource>('author'),
    author: me,
    enabled: ownEnabled('audio'),
  }),
}
const ownFeed = computed(() => ownFeeds[kind.value === 'audio' ? 'audio' : 'video'])

const favorites = useLibraryList(
  ref(FAVORITES),
  kind,
  computed(() => store.isOpen && pickSource.value === 'favorites')
)

const pickPosts = computed<AdaptedPost[]>(() =>
  pickSource.value === 'own'
    ? ownFeed.value.posts.value.filter((p) => mediaTypeOf(p) === kind.value)
    : favorites.posts.value
)
const pickLoading = computed(() =>
  pickSource.value === 'own' ? ownFeed.value.loading.value : favorites.loading.value
)
const pickHasMore = computed(() =>
  pickSource.value === 'own' ? ownFeed.value.hasMore.value : favorites.hasMore.value
)
const pickEmptyText = computed(() =>
  pickSource.value === 'own'
    ? t(`lists.noOwn.${kind.value === 'audio' ? 'audio' : 'video'}`)
    : t(`library.emptyFavorites.${kind.value}`)
)

function pickMore(): void {
  if (pickSource.value === 'own') ownFeed.value.loadMore()
  else favorites.loadMore()
}

function togglePick(post: AdaptedPost): void {
  const id = postId(post)
  if (ids.value.includes(id)) ids.value = ids.value.filter((x) => x !== id)
  else if (ids.value.length < maxItems.value) {
    posts.value = new Map(posts.value).set(id, post)
    ids.value = [...ids.value, id]
  }
}

// --- Порядок ---

const listRef = ref<{ $el?: HTMLElement } | HTMLElement | null>(null)
const { dragIndex, onPointerDown, onHandleKey } = usePointerReorder(
  listRef,
  (from, to) => {
    const next = [...ids.value]
    const [moved] = next.splice(from, 1)
    if (moved) next.splice(to, 0, moved)
    ids.value = next
  },
  () => ids.value.length
)

function removeAt(index: number): void {
  ids.value = ids.value.filter((_, i) => i !== index)
}

function itemTitle(id: string): string {
  const post = posts.value.get(id)
  if (post === null) return t('collections.itemRemoved')
  if (!post) return '…'
  return mediaTitle(post) || t('media.untitled')
}

// --- Обложка ---

const fileInput = ref<HTMLInputElement | null>(null)

function pickCover(): void {
  fileInput.value?.click()
}

async function onCoverFile(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  uploading.value = true
  try {
    const base64 = await resizeImageBase64(await fileToBase64(file), {
      maxWidth: 1080,
      maxHeight: 1080,
    })
    customImage.value = await uploadImage(base64)
  } catch {
    appToast.error({ message: t('collections.editor.coverFailed') })
  } finally {
    uploading.value = false
  }
}

// --- Сохранение ---

function draft(): CollectionDraft {
  const base: CollectionDraft = original
    ? draftOf(original, ids.value)
    : {
        kind: kind.value,
        caption: '',
        description: '',
        image: '',
        lang: uiStore.contentLanguage,
        contentIds: [...ids.value],
        settings: {},
      }
  const settings = { ...(base.settings ?? {}) }
  // Своей обложки нет — пусть подставится превью первого элемента (withAutoCover).
  const image =
    customImage.value ||
    (typeof settings[AUTO_COVER_KEY] === 'string' ? (settings[AUTO_COVER_KEY] as string) : '')
  return {
    ...base,
    kind: original?.kind ?? kind.value,
    caption: caption.value,
    description: description.value,
    image,
    settings,
  }
}

const bytes = computed(() => collectionPayloadBytes(collectionPayload(draft())))
const invalid = computed(() => {
  if (isPublic.value) return validateCollectionDraft(draft())
  const name = caption.value.trim()
  if (!name || [...name].length > COLLECTION_CAPTION_MAX) return 'caption'
  return ids.value.length > LIBRARY_LIST_MAX ? 'tooMany' : null
})
const changed = computed(() => {
  if (!original) return true
  const d = draft()
  return (
    d.caption.trim() !== original.caption ||
    d.description.trim() !== original.description ||
    (customImage.value || '') !==
      (original.image !== original.settings[AUTO_COVER_KEY] ? original.image : '') ||
    d.contentIds.join(',') !== original.contentIds.join(',')
  )
})
const canSave = computed(() => !loading.value && !saving.value && !invalid.value && changed.value)

const saveLabel = computed(() => {
  if (mode.value === 'edit') return t('collections.editor.save')
  return store.target?.replaces ? t('lists.publish') : t('collections.editor.create')
})

const noteText = computed(() => {
  if (mode.value === 'edit') return t('collections.editor.editNote', { max: COLLECTION_EDIT_LIMIT })
  if (!isPublic.value) return t('lists.privateNote')
  return store.target?.replaces ? t('lists.makePublicNote') : t('collections.editor.createNote')
})

watch(invalid, (reason) => {
  if (reason === 'tooBig') errorText.value = t('collections.invalid.tooBig')
  else if (reason === 'tooMany')
    errorText.value = isPublic.value ? t('collections.invalid.tooMany') : t('library.full')
  else if (errorText.value && !loading.value) errorText.value = ''
})

async function save(): Promise<void> {
  if (!canSave.value) return
  if (!isPublic.value) {
    savePrivate()
    return
  }
  saving.value = true
  errorText.value = ''
  try {
    const replaces = store.target?.replaces
    if (original) {
      const result = await collections.edit(original.txid, draft())
      appToast.success({
        message:
          result === 'queued'
            ? t('collections.queued', { name: caption.value })
            : t('collections.saved'),
      })
    } else {
      const txid = await collections.create(draft(), replaces)
      appToast.success({ message: replaces ? t('lists.madePublic') : t('collections.created') })
      void router.push(`/collection/${txid}`)
    }
    store.close()
  } catch (e) {
    errorText.value = e instanceof Error ? e.message : t('collections.sendFailed')
  } finally {
    saving.value = false
  }
}

function savePrivate(): void {
  const name = caption.value.trim()
  const id = library.createPlaylist(kind.value, name, ids.value)
  if (!id) {
    errorText.value = t('library.tooManyPlaylists')
    return
  }
  appToast.success({ message: t('lists.created', { name }) })
  store.close()
  void router.push(`/library/${id}`)
}

function close(): void {
  if (!saving.value) store.close()
}
</script>
