// Страница справки: всё её состояние — в адресе. Статья — `/help/<id>`,
// раздел — `#якорь`, подсветка найденного — `?hl=<запрос>`. Поэтому «Назад»,
// ссылки и обновление страницы работают сами. Кнопки «Назад/Вперёд» панели
// листают только справку: как в CHM, из справки они не уводят.
import {
  computed,
  inject,
  nextTick,
  provide,
  ref,
  watch,
  type ComputedRef,
  type InjectionKey,
  type Ref,
  type ShallowRef,
} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { appToast } from '@/b-components/app-toast'
import { HELP_VIEW, topicPath } from '@/b-components/help/help-view'
import { useDocumentTitle } from '@/composables/use-document-title'
import { useHelpLibrary } from '@/composables/use-help-library'
import { copyText } from '@/helpers/common/clipboard'
import { publicShareOrigin } from '@/helpers/common/share-origin'
import { GLOSSARY_TOPIC } from '@/helpers/help/help-library'
import { queryStems } from '@/helpers/help/help-stem'
import type { HelpLibrary, HelpLinkTarget, HelpTopic } from '@/helpers/help/help-types'

export type HelpTab = 'contents' | 'index' | 'search' | 'favorites'

export interface HelpPage {
  library: ShallowRef<HelpLibrary | null>
  failed: Ref<boolean>
  retry: () => void
  topicId: ComputedRef<string | null>
  topic: ComputedRef<HelpTopic | null>
  highlighted: ComputedRef<boolean>
  tab: Ref<HelpTab>
  /** Что набрано во вкладках «Указатель» и «Поиск» — не теряется при переключении. */
  indexFilter: Ref<string>
  searchQuery: Ref<string>
  canBack: Ref<boolean>
  canForward: Ref<boolean>
  navigate: (target: HelpLinkTarget, highlight?: string) => void
  openTopic: (id: string, highlight?: string) => void
  back: () => void
  forward: () => void
  clearHighlight: () => void
  copyLink: () => Promise<void>
  /** Путь по оглавлению для списков: «Книга › Раздел». */
  whereIs: (id: string) => string
}

export const HELP_PAGE: InjectionKey<HelpPage> = Symbol('help-page')

export function useHelpPageContext(): HelpPage {
  const page = inject(HELP_PAGE)
  if (!page) throw new Error('help navigator outside of the help page')
  return page
}

function decodeHash(hash: string): string {
  const raw = hash.replace(/^#/, '')
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

/** Путь, куда ведёт «Назад» или «Вперёд» (vue-router хранит его в history.state). */
function historyPath(key: 'back' | 'forward'): string | null {
  const state = window.history.state as Record<string, unknown> | null
  const path = state?.[key]
  return typeof path === 'string' ? path : null
}

export function useHelpPage(): HelpPage {
  const route = useRoute()
  const router = useRouter()
  const { t } = useI18n()
  const { library, failed, retry } = useHelpLibrary()

  const topicId = computed(() =>
    typeof route.params.topic === 'string' && route.params.topic ? route.params.topic : null
  )
  const topic = computed(() =>
    topicId.value ? (library.value?.topics.get(topicId.value) ?? null) : null
  )
  const hl = computed(() => (typeof route.query.hl === 'string' ? route.query.hl : ''))
  const highlight = computed(() => queryStems(hl.value))
  const highlighted = computed(() => highlight.value.length > 0)
  const tab = ref<HelpTab>(hl.value ? 'search' : 'contents')
  const indexFilter = ref('')
  const searchQuery = ref(hl.value)

  function openTopic(id: string, query?: string): void {
    void router.push({ path: topicPath(id), query: query ? { hl: query } : {} })
  }

  function navigate(target: HelpLinkTarget, query?: string): void {
    if (target.kind === 'home') void router.push('/help')
    else if (target.kind === 'app') void router.push(target.path)
    else if (target.kind === 'topic' || target.kind === 'term') {
      const id = target.kind === 'term' ? GLOSSARY_TOPIC : target.topic
      const anchor = target.anchor
      void router.push({
        path: topicPath(id),
        hash: anchor ? `#${anchor}` : '',
        query: query ? { hl: query } : {},
      })
    }
  }

  provide(HELP_VIEW, { library, highlight, navigate })

  useDocumentTitle(() => topic.value?.title ?? (topicId.value ? null : t('routes.help')))

  // Новая статья — к началу, раздел — к нему. Ждём, пока справка загрузится.
  watch(
    () => [topicId.value, route.hash, library.value] as const,
    async ([, hash, lib]) => {
      if (!lib) return
      await nextTick()
      const anchor = decodeHash(hash)
      const target = anchor ? document.getElementById(anchor) : null
      if (target) target.scrollIntoView({ block: 'start' })
      else window.scrollTo({ top: 0 })
    },
    { immediate: true }
  )

  const canBack = ref(false)
  const canForward = ref(false)
  watch(
    () => route.fullPath,
    () => {
      canBack.value = historyPath('back')?.startsWith('/help') ?? false
      canForward.value = historyPath('forward')?.startsWith('/help') ?? false
    },
    { immediate: true }
  )

  function clearHighlight(): void {
    void router.replace({ path: route.path, hash: route.hash })
  }

  async function copyLink(): Promise<void> {
    const path = topicId.value ? topicPath(topicId.value) : '/help'
    const copied = await copyText(`${publicShareOrigin()}${path}`)
    if (copied) appToast.success({ message: t('help.toolbar.linkCopied') })
    else appToast.error({ message: t('help.toolbar.copyFailed') })
  }

  function whereIs(id: string): string {
    const lib = library.value
    if (!lib) return ''
    return (lib.trail.get(id) ?? []).map((book) => lib.topics.get(book)?.title ?? book).join(' › ')
  }

  const page: HelpPage = {
    library,
    failed,
    retry,
    topicId,
    topic,
    highlighted,
    tab,
    indexFilter,
    searchQuery,
    canBack,
    canForward,
    navigate,
    openTopic,
    back: () => router.back(),
    forward: () => router.forward(),
    clearHighlight,
    copyLink,
    whereIs,
  }
  provide(HELP_PAGE, page)
  return page
}
