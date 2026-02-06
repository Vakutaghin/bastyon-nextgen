import { defineComponent } from 'vue'
import AppHeader from '@/b-components/header/app-header/app-header.vue'
import MessengerWrapper from '@/b-components/messenger/components/messenger-wrapper/messenger-wrapper.vue'
import { StarExplosion } from '@/b-components/effects/star-explosion'
import {
  SC_Application,
  SC_Camera,
  SC_Appcnt
} from './styled'

export const appLayoutOptions = defineComponent({
  name: 'AppLayout',
  components: {
    AppHeader,
    MessengerWrapper,
    StarExplosion,
    SC_Application,
    SC_Camera,
    SC_Appcnt,
  }
})
