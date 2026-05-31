import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { Z_INDEX, TRANSITIONS } from '@/styles/design-tokens'

/**
 * Контейнер мини-приложения. Покрывает весь viewport поверх нашего хедера/сайдбара.
 * MINIAPP_FRAME (500) — выше обычного контента, ниже messenger (DROPDOWN=1000),
 * чтобы виджет чата висел поверх iframe.
 */
export const SC_Frame = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${Z_INDEX.MINIAPP_FRAME};
  background: ${COLORS.BG_PRIMARY};
  display: flex;
  flex-direction: column;
`

export const SC_IframeWrap = styled.div`
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: ${COLORS.BG_PRIMARY};
`

export const SC_Iframe = styled.iframe`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  background: transparent;
`

export const SC_Loader = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: ${COLORS.BG_PRIMARY};
  pointer-events: none;
  opacity: 1;
  transition: opacity ${TRANSITIONS.FAST};

  &.hidden {
    opacity: 0;
  }
`

export const SC_LoaderIcon = styled.img`
  width: 72px;
  height: 72px;
  border-radius: 18px;
  animation: pulse 1.6s ease-in-out infinite;

  @keyframes pulse {
    0%,
    100% {
      transform: scale(1);
      opacity: 0.85;
    }

    50% {
      transform: scale(0.92);
      opacity: 0.55;
    }
  }
`

export const SC_LoaderText = styled.div`
  font-size: 13px;
  color: ${COLORS.TEXT_SECONDARY};
`

export const SC_Error = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  text-align: center;
  color: ${COLORS.TEXT_PRIMARY};
  font-size: 14px;
`

/**
 * Деликатный «лепесток» закрытия в правом верхнем углу, на 16px ниже верха viewport'а.
 * По дефолту почти невидим: виден только тонкий 6px-полукруг полупрозрачного цвета.
 * При наведении выезжает целиком, становится контрастным и показывает подпись.
 *
 * Идея: не отвлекать от контента миниаппы, но оставить affordance.
 */
export const SC_ClosePetal = styled.button`
  appearance: none;
  border: none;
  font: inherit;
  position: fixed;
  top: 16px;
  right: 0;
  z-index: ${Z_INDEX.MINIAPP_PETAL};
  display: flex;
  align-items: center;
  gap: 8px;
  height: 28px;
  padding: 0 14px 0 10px;
  background: ${COLORS.OVERLAY_15};
  color: ${COLORS.WHITE_75};
  border-radius: 14px 0 0 14px;
  cursor: pointer;
  user-select: none;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  opacity: 0.6;

  /* Прячем за правый край, оставляя 14px видимого язычка — заметно но ненавязчиво. */
  transform: translateX(calc(100% - 14px));
  transition:
    transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    background-color ${TRANSITIONS.FAST},
    opacity ${TRANSITIONS.FAST},
    color ${TRANSITIONS.FAST};

  &:hover,
  &:focus-visible {
    transform: translateX(0);
    background: ${COLORS.OVERLAY_70};
    color: ${COLORS.WHITE};
    opacity: 1;
    outline: none;
  }
`

export const SC_ClosePetalIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  font-size: 11px;
  flex: 0 0 auto;
`

export const SC_ClosePetalLabel = styled.span`
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
`
