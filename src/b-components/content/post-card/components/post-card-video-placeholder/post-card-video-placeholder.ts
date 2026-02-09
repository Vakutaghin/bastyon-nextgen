import { defineComponent } from 'vue'
import { PlayCircleFilled } from '@ant-design/icons-vue'
import { SC_VideoPlaceholder } from './styled'

export const postCardVideoPlaceholderOptions = defineComponent({
  name: 'PostCardVideoPlaceholder',
  components: {
    PlayCircleFilled,
    SC_VideoPlaceholder
  }
})
