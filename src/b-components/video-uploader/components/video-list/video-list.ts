import { onBeforeUnmount } from 'vue'
import { Spin } from 'ant-design-vue'
import Empty from '@/components/empty/empty.vue'
import {
  PlayCircleOutlined,
  InfoCircleOutlined,
  CloseOutlined,
  DownloadOutlined,
  VideoCameraAddOutlined,
} from '@/components/icons'
import {
  SC_VideosSection,
  SC_SectionTitle,
  SC_VideosGrid,
  SC_VideoItem,
  SC_VideoIcon,
  SC_VideoName,
  SC_VideoResolution,
  SC_VideoActions,
  SC_ActionButton,
  SC_EmptyState,
  SC_LoadingState,
} from './styled'

export function useVideoList() {
  onBeforeUnmount(() => {
    const style = document.getElementById('video-list-icon-styles')
    if (style) {
      style.remove()
    }
  })

  return {
    Empty,
    Spin,
    PlayCircleOutlined,
    InfoCircleOutlined,
    CloseOutlined,
    DownloadOutlined,
    VideoCameraAddOutlined,
    SC_VideosSection,
    SC_SectionTitle,
    SC_VideosGrid,
    SC_VideoItem,
    SC_VideoIcon,
    SC_VideoName,
    SC_VideoResolution,
    SC_VideoActions,
    SC_ActionButton,
    SC_EmptyState,
    SC_LoadingState,
  }
}
