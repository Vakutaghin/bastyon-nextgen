import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_VideoPlaceholder = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: linear-gradient(135deg, ${COLORS.BORDER_LIGHTER} 0%, ${COLORS.BORDER_LIGHT} 100%);
  border-radius: 8px;
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed ${COLORS.BORDER_LIGHT};

  .video-icon {
    font-size: 60px;
    color: ${COLORS.TEXT_MUTED};
  }
`
