import styled from 'vue3-styled-components'

export const SC_VideoMessage = styled.div`
  display: flex;
  flex-direction: column;
  max-width: 100%;
  min-width: 0;
`

export const SC_VideoFrame = styled('div', { aspect: String, isLocal: Boolean })`
  position: relative;
  width: 100%;
  max-width: min(320px, 100%);
  aspect-ratio: ${(p: any) => p.aspect || '16 / 9'};
  background: #000;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: ${(p: any) => (p.isLocal ? 0.85 : 1)};
`

export const SC_Poster = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`

export const SC_PosterPlaceholder = styled.div`
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #263238, #455a64);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 36px;
`

export const SC_Video = styled.video`
  width: 100%;
  height: 100%;
  display: block;
  background: #000;
`

export const SC_PlayOverlay = styled.button`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 0;
  cursor: pointer;
  padding: 0;
  margin: 0;
`

export const SC_PlayIcon = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);

  &::before {
    content: '';
    width: 0;
    height: 0;
    border-left: 18px solid #fff;
    border-top: 11px solid transparent;
    border-bottom: 11px solid transparent;
    margin-left: 5px;
  }
`

export const SC_Spinner = styled.div`
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`

export const SC_DurationBadge = styled.div`
  position: absolute;
  right: 8px;
  bottom: 8px;
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  pointer-events: none;
`

export const SC_ProgressBadge = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  pointer-events: none;
`

export const SC_ErrorBadge = styled.button`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 12px;
  border: 0;
  cursor: pointer;
  padding: 8px;
`
