import styled from 'vue3-styled-components'

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
  border: 0;
  background: var(--ui-primary);
  color: var(--ui-text-inverted);
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;

  &:hover:not(:disabled) {
    background: rgb(var(--ui-primary-rgb) / 75%);
    color: var(--ui-text-inverted);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

export const SC_WaveContainer = styled('div', { compact: Boolean })`
  flex: 1 1 ${(p) => (p.compact ? '120px' : '240px')};
  width: 100%;
  max-width: ${(p) => (p.compact ? '120px' : '240px')};
  min-width: 0;
  height: 36px;
  position: relative;
  cursor: pointer;
  overflow: hidden;

  /*
   * Critical: canvas волны позиционируется абсолютно. Иначе его style.width (которую
   * рендер выставляет по текущему dom.clientWidth) становится
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

export const SC_WaveSpinnerOverlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
`

export const SC_SpinnerRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`

export const SC_UploadProgress = styled.span`
  font-size: 12px;
  color: var(--color-blue-gray);
`

export const SC_TimeLabel = styled.div`
  font-size: 12px;
  color: var(--color-blue-gray);
  user-select: none;
  flex-shrink: 0;
`

export const SC_Error = styled.div`
  font-size: 12px;
  color: var(--color-red-dark);
`
export const SC_Spinner = styled.div`
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-bg-tertiary);
  border-top-color: var(--ui-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite; /* @keyframes spin — глобально в style.css */
`
