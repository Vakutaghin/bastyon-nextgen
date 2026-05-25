import { defineComponent, onMounted } from 'vue'
import AppHeader from '@/b-components/header/app-header/app-header.vue'
import MessengerWrapper from '@/b-components/messenger/components/messenger-wrapper/messenger-wrapper.vue'
import PostModal from '@/b-components/content/post-modal/post-modal.vue'
import WhatsNewModal from '@/b-components/changelog/whats-new-modal.vue'
import { StarExplosion } from '@/b-components/effects/star-explosion'
import { useUIStore } from '@/stores/ui-store'
import { SC_Application, SC_Camera, SC_Appcnt } from './styled'

export const appLayoutOptions = defineComponent({
  name: 'AppLayout',
  components: {
    AppHeader,
    MessengerWrapper,
    PostModal,
    WhatsNewModal,
    StarExplosion,
    SC_Application,
    SC_Camera,
    SC_Appcnt,
  },
  setup() {
    const uiStore = useUIStore()

    onMounted(() => {
      void uiStore.loadLanguage()
    })

    return {}
  },
})
