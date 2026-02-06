import { onBeforeUnmount } from 'vue'
import { Empty, Spin } from 'ant-design-vue'
import {
  PlayCircleOutlined,
  InfoCircleOutlined,
  CloseOutlined,
  DownloadOutlined
} from '@ant-design/icons-vue'
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
  SC_LoadingState
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
    SC_LoadingState
  }
}
