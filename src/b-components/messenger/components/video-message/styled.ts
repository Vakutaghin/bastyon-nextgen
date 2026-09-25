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
  aspect-ratio: ${(p) => p.aspect || '16 / 9'};
  background: var(--color-black);
  border-radius: var(--ui-radius-lg);
  overflow: hidden;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: ${(p) => (p.isLocal ? 0.85 : 1)};
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
  background: linear-gradient(135deg, var(--color-dark-bg), var(--color-text-dark));
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-white-60);
  font-size: 36px;
`

export const SC_Video = styled.video`
  width: 100%;
  height: 100%;
  display: block;
  background: var(--color-black);
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
  background: var(--color-overlay-55);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);

  &::before {
    content: '';
    width: 0;
    height: 0;
    border-left: 18px solid var(--color-white);
    border-top: 11px solid transparent;
    border-bottom: 11px solid transparent;
    margin-left: 5px;
  }
`

export const SC_Spinner = styled.div`
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-white-20);
  border-top-color: var(--color-white);
  border-radius: 50%;
  animation: spin 1s linear infinite; /* @keyframes spin — глобально в style.css */
`

export const SC_DurationBadge = styled.div`
  position: absolute;
  right: 8px;
  bottom: 8px;
  background: var(--color-overlay-65);
  color: var(--color-white);
  font-size: 12px;
  padding: 2px 6px;
  border-radius: var(--ui-radius-sm);
  pointer-events: none;
`

export const SC_ProgressBadge = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-overlay-45);
  color: var(--color-white);
  font-size: 12px;
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
  background: var(--color-overlay-55);
  color: var(--color-white);
  font-size: 12px;
  border: 0;
  cursor: pointer;
  padding: 8px;
`

export const SC_RetryLink = styled.span`
  opacity: 0.8;
  text-decoration: underline;
`
