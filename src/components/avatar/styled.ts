import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_Avatar = styled.div<{
  backgroundColor?: string
  color?: string
  shape?: 'circle' | 'square',
}>`
  position: relative;
  border-radius: ${(p) => p.shape === 'square' ? '4px' : '50%'};
  overflow: visible;

  :deep(.ant-avatar) {
    background: ${(p) => p.backgroundColor || COLORS.PRIMARY};
    color: ${(p) => p.color || 'white'};
    border: 2px solid ${COLORS.BORDER_LIGHT};
    border-radius: ${(p) => p.shape === 'square' ? '4px' : '50%'};
    font-weight: 600;
  }

  :deep(.ant-avatar img) {
    object-fit: cover;
    border-radius: ${(p) => p.shape === 'square' ? '4px' : '50%'};
  }

  .verified-badge {
    position: absolute;
    right: -2px;
    bottom: -2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #1890ff;
    border: 2px solid #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 0 1px rgba(0,0,0,0.06);
    z-index: 2;
  }

  .pending-badge {
    position: absolute;
    left: -2px;
    bottom: -2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #faad14;
    border: 2px solid #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 0 1px rgba(0,0,0,0.06);
    z-index: 2;
  }
`
