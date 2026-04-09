import { defineComponent } from 'vue'
import {
  SC_MyVideosWork,
  SC_MyVideosPage,
  SC_MyVideosTitle,
  SC_MyVideosPlaceholder,
} from './my-videos-page.styled'

export default defineComponent({
  name: 'MyVideosPage',
  components: {
    SC_MyVideosWork,
    SC_MyVideosPage,
    SC_MyVideosTitle,
    SC_MyVideosPlaceholder,
  },
})
