import styled from 'vue3-styled-components'

export const SC_AudioMessage = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
`

export const SC_PlayButton = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid #cfd8dc;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;

  &.playing {
    border-color: #00A4DB;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

export const SC_WaveContainer = styled('div', { compact: Boolean })`
  flex: 0 0 ${(p: any) => p.compact ? '120px' : '240px'};
  width: ${(p: any) => p.compact ? '120px' : '240px'};
  height: 36px;
  position: relative;
  cursor: pointer;
`

export const SC_WavePlaceholder = styled('div', { compact: Boolean })`
  flex: 0 0 ${(props: any) => props.compact ? '160px' : '240px'};
  width: ${(props: any) => props.compact ? '160px' : '240px'};
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
  color: #607d8b;
  user-select: none;
  flex-shrink: 0;
`

export const SC_Error = styled.div`
  font-size: 12px;
  color: #c62828;
`
export const SC_Spinner = styled.div`
  width: 16px;
  height: 16px;
  border: 2px solid #cfd8dc;
  border-top-color: #00A4DB;
  border-radius: 50%;
  animation: sc-spin 0.8s linear infinite;

  @keyframes sc-spin {
    to {
      transform: rotate(360deg);
    }
  }
`
