import styled from 'vue3-styled-components'

export const SC_ImageMessage = styled.div`
  display: flex;
  flex-direction: column;
  max-width: 100%;
  min-width: 0;
`

export const SC_ImageFrame = styled('div', { aspect: String, isLocal: Boolean })`
  position: relative;
  width: 100%;
  max-width: min(280px, 100%);
  aspect-ratio: ${(p: any) => p.aspect || '4 / 3'};
  background: #eceff1;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: ${(p: any) => (p.isLocal ? 0.7 : 1)};
`

export const SC_Image = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`

export const SC_Spinner = styled.div`
  width: 28px;
  height: 28px;
  border: 3px solid #cfd8dc;
  border-top-color: #00a4db;
  border-radius: 50%;
  animation: spin 1s linear infinite; /* @keyframes spin — глобально в style.css */
`

export const SC_ProgressBadge = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.25);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
`

export const SC_ErrorBadge = styled.button`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: 12px;
  border: 0;
  cursor: pointer;
  padding: 8px;
`

export const SC_Lightbox = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 24px;
  cursor: zoom-out;
`

export const SC_LightboxImg = styled.img`
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  cursor: default;
`
