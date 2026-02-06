import { defineComponent, computed, type PropType } from 'vue'
import { SC_ProfileCover, SC_CoverImage } from './styled'
import type { UserProfile } from '@/types/rpc-responses/user-get'

export default defineComponent({
  name: 'ProfileCover',
  components: {
    SC_ProfileCover,
    SC_CoverImage
  },
  props: {
    profile: {
      type: Object as PropType<UserProfile | null>,
      default: null
    }
  },
  setup(props) {
    const coverImage = computed(() => {
      if (!props.profile) return ''

      // 1. Пробуем из accSet (настройки аккаунта)
      const profileAny = props.profile as any

      if (profileAny.accSet) {
        if (profileAny.accSet.cover) {
           return profileAny.accSet.cover
        }
      }

      // 2. Пробуем извлечь обложку из поля b (JSON)
      if (props.profile.b) {
        try {
          const json = JSON.parse(props.profile.b)

          if (json && (json.cover || json.image)) {
            return json.cover || json.image
          }
        } catch (e) {
          console.error('Failed to parse profile JSON:', e)
        }
      }

      return ''
    })

    const displayImage = computed(() => {
      if (coverImage.value) {
        return coverImage.value
      }

      if (props.profile && props.profile.i) {
        return props.profile.i
      }

      return ''
    })

    const isBlur = computed(() => {
      // Блюрим только если нет реальной обложки, но есть аватарка (которая используется как фон)
      return !coverImage.value && !!(props.profile && props.profile.i)
    })


    return {
      coverImage,
      displayImage,
      isBlur
    }
  }
})
