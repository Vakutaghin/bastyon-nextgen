import { defineComponent, watch, computed, type PropType } from 'vue'
import { useProfileFeed } from '@/composables/use-profile-feed'
import PostCard from '@/b-components/content/post-card/post-card.vue'
import Spin from '@/components/spin/spin.vue'
import { LoadingOutlined } from '@ant-design/icons-vue'
import type { UserProfile } from '@/types/rpc-responses/user-get'
import {
  SC_ProfileFeed,
  SC_FeedContent,
  SC_LoadMoreTrigger,
  SC_LoadingSpinner,
  SC_NoMorePosts,
  SC_EmptyFeed,
  SC_ErrorMessage
} from './styled'

export default defineComponent({
  name: 'ProfileFeed',
  components: {
    PostCard,
    SC_ProfileFeed,
    SC_FeedContent,
    SC_LoadMoreTrigger,
    SC_LoadingSpinner,
    SC_NoMorePosts,
    SC_EmptyFeed,
    SC_ErrorMessage,
    Spin,
    LoadingOutlined
  },
  props: {
    address: {
      type: String,
      required: true
    },
    profile: {
      type: Object as PropType<UserProfile | null>,
      default: null
    },
    /** Язык контента для getprofilefeed: '' = все языки, 'ru'/'en' и т.д. Если не задан — используется 'ru'. */
    lang: {
      type: String,
      default: undefined
    }
  },
  emits: ['profile-loaded'],
  setup(props, { emit }) {
    const {
      allPosts,
      userProfile,
      isLoading,
      isLoadingMore,
      error,
      hasMore,
      loadMoreTrigger
    } = useProfileFeed({
      address: props.address,
      ...(props.lang !== undefined && { lang: props.lang })
    })

    // Если профиль загрузился через ленту, сообщаем об этом наверх
    watch(userProfile, (newProfile) => {
      if (newProfile) {
        emit('profile-loaded', newProfile)
      }
    })

    const authorOverride = computed(() => {
      const p = props.profile || userProfile.value
      if (!p) return null

      return {
        name: p.name || '',
        address: p.address || '',
        avatar: p.i || null,
        reputation: p.reputation || 0,
        letter: p.name ? p.name[0] : '?'
      }
    })

    return {
      allPosts,
      authorOverride,
      isLoading,
      isLoadingMore,
      error,
      hasMore,
      loadMoreTrigger
    }
  }
})
