import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_MessengerButton = styled('button', { isOpen: Boolean })`
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background-color: ${COLORS.BRAND_CYAN};
  color: ${COLORS.WHITE};
  border: none;
  box-shadow: ${COLORS.SHADOW_MD};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition:
    transform 0.2s,
    background-color 0.2s;
  z-index: 1001;
  pointer-events: auto;

  &:hover {
    transform: scale(1.05);
    background-color: ${COLORS.BRAND_CYAN_HOVER};
  }

  &:active {
    transform: scale(0.95);
  }

  img {
    width: 28px;
    height: 28px;
    ${(props) =>
      !props.isOpen
        ? `
      position: relative;
      top: 2px;
      left: 0;
    `
        : ''}
  }
`

export const SC_UnreadBadge = styled.span`
  position: absolute;
  top: -4px;
  right: -4px;
  background-color: ${COLORS.RED_BRIGHT};
  color: ${COLORS.WHITE};
  font-size: 12px;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 10px;
  border: 2px solid ${COLORS.WHITE};
  min-width: 20px;
  text-align: center;
`
