import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_Avatar = styled.div<{
  backgroundColor?: string
  color?: string
  shape?: 'circle' | 'square'
}>`
  position: relative;
  border-radius: ${(p) => (p.shape === 'square' ? '4px' : '50%')};
  overflow: visible;

  :deep(.ant-avatar) {
    background: ${(p) => p.backgroundColor || COLORS.PRIMARY};
    color: ${(p) => p.color || COLORS.WHITE};
    border: 2px solid ${COLORS.BORDER_LIGHT};
    border-radius: ${(p) => (p.shape === 'square' ? '4px' : '50%')};
    font-weight: 600;
  }

  :deep(.ant-avatar img) {
    object-fit: cover;
    border-radius: ${(p) => (p.shape === 'square' ? '4px' : '50%')};
  }

  .verified-badge {
    position: absolute;
    right: -2px;
    bottom: -2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: ${COLORS.ANT_BLUE};
    border: 2px solid ${COLORS.WHITE};
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: ${COLORS.SHADOW_SM};
    z-index: 2;
  }

  .pending-badge {
    position: absolute;
    left: -2px;
    bottom: -2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: ${COLORS.WARNING_ICON};
    border: 2px solid ${COLORS.WHITE};
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: ${COLORS.SHADOW_SM};
    z-index: 2;
  }
`
