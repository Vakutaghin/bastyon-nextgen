import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_QrFrame = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  background: ${COLORS.BG_PRIMARY};
  border: 1px solid ${COLORS.BORDER_LIGHTER};
  border-radius: 8px;
  cursor: zoom-in;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    border-color: ${COLORS.PRIMARY_LIGHT_50};
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
  }

  img {
    display: block;
    width: 84px;
    height: 84px;
  }
`

export const SC_QrModalBackdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  cursor: zoom-out;
`

export const SC_QrModalCard = styled.div`
  background: ${COLORS.BG_PRIMARY};
  border-radius: 14px;
  padding: 24px;
  max-width: 90vw;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25);
  text-align: center;
  cursor: default;
`

export const SC_QrModalImage = styled.img`
  display: block;
  width: 320px;
  max-width: 100%;
  margin: 0 auto;
`

export const SC_QrModalAddr = styled.div`
  margin-top: 14px;
  font-family: 'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  color: ${COLORS.TEXT_PRIMARY};
  word-break: break-all;
  max-width: 320px;
  margin-left: auto;
  margin-right: auto;
`

export const SC_QrPlaceholder = styled.div`
  width: 84px;
  height: 84px;
  background: ${COLORS.BG_DISABLED};
  border-radius: 4px;
`
