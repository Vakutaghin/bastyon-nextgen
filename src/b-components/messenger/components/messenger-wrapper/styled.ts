import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { BREAKPOINTS } from '@/styles/design-tokens'

/**
 * Иконка-svg, перекрашенная в белый через filter (исходник чёрный).
 * Заменяет inline `style="filter: brightness(0) invert(1)"`. CODE_AUDIT §3.1.
 */
export const SC_WhiteIcon = styled.img`
  filter: brightness(0) invert(1);
`

export const SC_MessengerWrapper = styled.div`
  position: fixed;
  bottom: 14px;
  right: 14px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  pointer-events: none;
`

export const SC_BackButton = styled.button`
  background: none;
  border: none;
  color: ${COLORS.WHITE};
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;

  &:hover {
    background-color: ${COLORS.WHITE_20};
  }

  svg,
  img {
    width: 24px;
    height: 24px;
    fill: currentColor;
    display: block;
  }
`

export const SC_FullScreenOverlay = styled.div`
  position: fixed;
  inset: var(--header-height-total) 0 0 0;
  width: 100%;
  height: calc(100vh - var(--header-height-total));
  z-index: 2500;
  background-color: ${COLORS.BG_PRIMARY};
  display: flex;
  flex-direction: column;
  padding-bottom: var(--safe-bottom);
  padding-left: var(--safe-left);
  padding-right: var(--safe-right);
`

export const SC_CloseOverlayButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${COLORS.TEXT_SECONDARY};

  &:hover {
    color: ${COLORS.TEXT_PRIMARY};
    background-color: ${COLORS.BG_TERTIARY};
    border-radius: 50%;
  }

  svg,
  img {
    width: 24px;
    height: 24px;
    fill: currentColor;
  }
`

export const SC_OverlayHeader = styled.div`
  padding: 16px;
  display: flex;
  justify-content: flex-end;
  background: ${COLORS.BG_PRIMARY};
  border-bottom: 1px solid ${COLORS.GRAY_EEE};
`

export const SC_OverlayContent = styled.div`
  flex: 1;
  overflow: hidden;
  padding: 20px;
  width: 100%;
  margin: 0 auto;
  max-width: var(--content-max-width);

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    padding: 0;
  }
`

export const SC_MessengerWrapperLoader = styled.div`
  flex: 1;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: ${COLORS.GRAY_888};
  font-size: 14px;
`

export const SC_MessengerWrapperSpinner = styled.span`
  display: inline-block;
  width: 32px;
  height: 32px;
  border: 3px solid ${COLORS.GRAY_E0};
  border-top-color: ${COLORS.TEXT_SECONDARY};
  border-radius: 50%;
  animation: spin 0.8s linear infinite; /* @keyframes spin — глобально в style.css */
`

export const SC_MessengerWrapperLoaderText = styled.span`
  margin: 0;
`
