import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_AudioMessage = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  min-width: 0;
`

export const SC_PlayButton = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid ${COLORS.BORDER};
  background: ${COLORS.BG_PRIMARY};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;

  &.playing {
    border-color: ${COLORS.BRAND_CYAN};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

export const SC_WaveContainer = styled('div', { compact: Boolean })`
  flex: 1 1 ${(p: any) => (p.compact ? '120px' : '240px')};
  width: 100%;
  max-width: ${(p: any) => (p.compact ? '120px' : '240px')};
  min-width: 0;
  height: 36px;
  position: relative;
  cursor: pointer;
  overflow: hidden;

  /*
   * Critical: PIXI canvas is positioned absolutely. Иначе его style.width (которую
   * PIXI выставляет в момент init на основе текущего dom.clientWidth) становится
   * «intrinsic content size» этого контейнера, и в flex-row родителе пузырь
   * усыхает до canvas-размера. Получается петля — контейнер ужался до маленького
   * canvas → max-content пузыря маленький → flex-basis 240 не получает простора →
   * canvas остаётся маленьким. Абсолютное позиционирование разрывает связь.
   */
  & > canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
`

export const SC_WavePlaceholder = styled('div', { compact: Boolean })`
  flex: 1 1 ${(props: any) => (props.compact ? '160px' : '240px')};
  width: 100%;
  max-width: ${(props: any) => (props.compact ? '160px' : '240px')};
  min-width: 0;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
`

export const SC_WaveSpinnerOverlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
`

export const SC_TimeLabel = styled.div`
  font-size: 12px;
  color: ${COLORS.BLUE_GRAY};
  user-select: none;
  flex-shrink: 0;
`

export const SC_Error = styled.div`
  font-size: 12px;
  color: ${COLORS.RED_DARK};
`
export const SC_Spinner = styled.div`
  width: 16px;
  height: 16px;
  border: 2px solid ${COLORS.BG_TERTIARY};
  border-top-color: ${COLORS.BRAND_CYAN};
  border-radius: 50%;
  animation: spin 0.8s linear infinite; /* @keyframes spin — глобально в style.css */
`
