<template>
  <!-- ➀ Загрузка -->
  <SC_Loading v-if="isLoading">
    <SC_Spinner />
    <span>{{ t('chat.postLoading') }}</span>
  </SC_Loading>

  <!-- ➁ Ошибка/нет такого поста — даём fallback-ссылку -->
  <SC_FailedHint
    v-else-if="isError || isMissing || !post"
    :href="httpsUrl"
    target="_blank"
    rel="noopener noreferrer"
  >
    <span aria-hidden="true">🔗</span>
    <span>{{ t('chat.postInBastyon') }}</span>
    <SC_ShortTxid>{{ shortTxid }}</SC_ShortTxid>
  </SC_FailedHint>

  <!-- ➂ Успех — компактная карточка -->
  <SC_PostEmbed v-else @click="openPost">
    <SC_Header>
      <SC_Avatar>
        <SC_AvatarImg
          v-if="avatarUrl"
          :src="avatarUrl"
          :alt="post.author.name"
          loading="lazy"
          @error="avatarFailed = true"
          v-show="!avatarFailed"
        />
        <span v-if="!avatarUrl || avatarFailed">{{ post.author.letter }}</span>
      </SC_Avatar>
      <SC_HeaderInfo>
        <SC_AuthorName :title="post.author.name">{{ post.author.name }}</SC_AuthorName>
        <SC_BadgeRow>
          <span v-if="isVideoTarget" :title="t('chat.videoPost')">🎬</span>
          <span>{{ formattedDate }}</span>
        </SC_BadgeRow>
      </SC_HeaderInfo>
    </SC_Header>

    <!-- Пост не для этого читателя: в чате видно только, что он закрыт. -->
    <SC_Body v-if="restriction">
      <SC_Snippet>🔒 {{ t(`postCard.visibility.${restriction}`) }}</SC_Snippet>
    </SC_Body>

    <SC_Thumb v-else-if="thumbnailUrl" :aspect="thumbAspect">
      <SC_ThumbImg :src="thumbnailUrl" :alt="post.title || 'post image'" loading="lazy" />
      <SC_VideoBadge v-if="isVideoTarget">
        <SC_VideoIcon />
      </SC_VideoBadge>
    </SC_Thumb>

    <SC_Body v-if="!restriction && (post.title || snippet)">
      <SC_Title v-if="post.title">{{ post.title }}</SC_Title>
      <SC_Snippet v-if="snippet">{{ snippet }}</SC_Snippet>
    </SC_Body>
  </SC_PostEmbed>
</template>

<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useModalStore } from '@/stores/modal-store'
import { resolveImageUrl } from '@/helpers/common/url-transformer'
import { formatDateTimeFull } from '@/helpers/common/date-formatter'
import { usePostByTxid } from './use-post-by-txid'
import { usePostRestriction } from '@/b-components/content/post-card/use-post-restriction'
import { postVisibilityOf } from '@/helpers/content/post-visibility'
import { usePaidSubscriptionsStore } from '@/stores/paid-subscriptions-store'
import { toBasytonHttpsUrl, type BastyonLinkTarget } from '../../lib/bastyon-link'
import {
  SC_PostEmbed,
  SC_Header,
  SC_Avatar,
  SC_AvatarImg,
  SC_HeaderInfo,
  SC_AuthorName,
  SC_BadgeRow,
  SC_Body,
  SC_Title,
  SC_Snippet,
  SC_Thumb,
  SC_ThumbImg,
  SC_VideoBadge,
  SC_VideoIcon,
  SC_Loading,
  SC_Spinner,
  SC_FailedHint,
  SC_ShortTxid,
} from './styled'

const props = defineProps<{
  target: BastyonLinkTarget
}>()

const { t } = useI18n()
const modalStore = useModalStore()

const txidRef = toRef(() => props.target.txid)
const { post, isLoading, isError, isMissing } = usePostByTxid(txidRef)

const isVideoTarget = computed(() => props.target.isVideo)

// Видимость — как в ленте: пост для подписчиков или платных подписчиков
// показывает текст и картинку только тем, кому он открыт.
const restrictionOf = usePostRestriction()
const restriction = computed(
  () =>
    (post.value && restrictionOf(post.value.author?.address, post.value.settings?.f)?.reason) ||
    null
)
const paidSubscriptions = usePaidSubscriptionsStore()
watch(post, (p) => {
  const author = p?.author?.address
  if (!author || postVisibilityOf(p?.settings?.f) !== 'paid') return
  void paidSubscriptions.ensurePrice(author)
  void paidSubscriptions.ensureMyPayments()
})

const shortTxid = computed(() => {
  const txid = props.target.txid
  return `${txid.slice(0, 6)}…${txid.slice(-4)}`
})

const httpsUrl = computed(() => toBasytonHttpsUrl(props.target))

const avatarFailed = ref(false)
const avatarUrl = computed<string | undefined>(() => {
  if (!post.value?.author?.avatar) return undefined
  return resolveImageUrl(post.value.author.avatar) || undefined
})

const thumbnailUrl = computed<string | undefined>(() => {
  if (!post.value) return undefined
  const firstImage = post.value.images?.[0]
  if (firstImage) return resolveImageUrl(firstImage) || undefined
  return undefined
})

const thumbAspect = computed<string>(() => {
  return isVideoTarget.value ? '16 / 9' : '4 / 3'
})

const formattedDate = computed<string>(() => {
  if (!post.value?.timestamp) return ''
  const ts = Math.floor(new Date(post.value.timestamp).getTime() / 1000)
  return formatDateTimeFull(ts) || ''
})

/** Превью текста: убираем HTML-теги, обрезаем до ~200 символов. */
const snippet = computed<string>(() => {
  const raw = post.value?.content || ''
  if (!raw) return ''
  const text = raw
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= 200) return text
  return text.slice(0, 200).trimEnd() + '…'
})

const openPost = () => {
  if (!post.value) return
  modalStore.openPostModal(post.value as Parameters<typeof modalStore.openPostModal>[0])
}
</script>
