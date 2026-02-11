import { defineComponent, watch, onMounted, nextTick, computed } from 'vue'
import { usePostsStore } from '@/stores/posts-store'
import { useFiltersStore } from '@/stores/filters-store'
import { useInfiniteFeed } from '@/composables/use-infinite-feed'
import PostCard from '@/b-components/content/post-card/post-card.vue'
import Button from '@/components/button/button.vue'
import Spin from '@/components/spin/spin.vue'
import Empty from '@/components/empty/empty.vue'
import {
  PlusOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  ReloadOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined
} from '@ant-design/icons-vue'
import {
  SC_Feed,
  SC_FeedHeader,
  SC_FeedHeaderLeft,
  SC_FeedHeaderActions,
  SC_SidebarToggleWrap,
  SC_FeedTitle,
  SC_FeedContent,
  SC_FeedLoading,
  SC_FeedError,
  SC_FeedLoadingMore,
  SC_FeedEnd
} from './styled'

export const contentFeedOptions = defineComponent({
  name: 'ContentFeed',
  components: {
    PostCard,
    Button,
    Spin,
    Empty,
    PlusOutlined,
    ExclamationCircleOutlined,
    LoadingOutlined,
    ReloadOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    SC_Feed,
    SC_FeedHeader,
    SC_FeedHeaderLeft,
    SC_FeedHeaderActions,
    SC_SidebarToggleWrap,
    SC_FeedTitle,
    SC_FeedContent,
    SC_FeedLoading,
    SC_FeedError,
    SC_FeedLoadingMore,
    SC_FeedEnd
  },
  props: {
    rightSidebarVisible: {
      type: Boolean,
      default: true
    },
    leftSidebarCollapsed: {
      type: Boolean,
      default: false
    }
  },
  emits: [ 'toggle-right-sidebar', 'toggle-left-sidebar' ],
  setup() {
    const postsStore = usePostsStore()
    const filtersStore = useFiltersStore()

    // Используем infinite feed для lazy loading
    const {
      allPosts,
      isLoading,
      isLoadingMore,
      error,
      hasMore,
      loadMoreTrigger,
      refetch
    } = useInfiniteFeed({
      initialLimit: 20,
      pageSize: 20,
      threshold: undefined, // Используем 100vh по умолчанию
      lang: 'ru',
      enabled: true
    })

    // Регистрируем посты в posts store при изменении
    const registerPosts = () => {
      allPosts.value.forEach(post => {
        postsStore.registerPost(post)
      })
    }

    // Регистрируем посты при монтировании и при обновлении
    onMounted(() => {
      nextTick(() => {
        registerPosts()
      })
    })

    watch(allPosts, () => {
      nextTick(() => {
        registerPosts()
      })
    }, { deep: true })

    const handleLike = (postId: string | number): void => {
      postsStore.likePost(postId)
    }

    const handleComment = (postId: string | number): void => {
      postsStore.commentPost(postId)
    }

    const handleShare = (postId: string | number): void => {
      postsStore.sharePost(postId)
    }

    const isServerError = computed(() => {
      if (!error.value) return false

      // Проверяем, что мы на вкладке подписок (id: 2)
      if (filtersStore.activeTab !== 2) return false

      // Здесь можно добавить более точную проверку структуры ошибки,
      // если error.value имеет определенный формат
      return true
    })

    const isFavoritesTab = computed(() => filtersStore.activeTab === 6)

    return {
      allPosts,
      isLoading,
      isLoadingMore,
      error,
      hasMore,
      loadMoreTrigger,
      handleLike,
      handleComment,
      handleShare,
      refetch,
      isServerError,
      isFavoritesTab
    }
  }
})
