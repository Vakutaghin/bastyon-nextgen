import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { TRANSITIONS } from '@/styles/design-tokens'

export const SC_QrScanner = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 0;
`

export const SC_QrActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`

export const SC_QrUploadLabel = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid ${COLORS.BORDER_DEFAULT};
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: ${COLORS.TEXT_PRIMARY};
  background: ${COLORS.BG_SECONDARY};
  transition:
    background ${TRANSITIONS.FAST},
    border-color ${TRANSITIONS.FAST};

  &:hover {
    background: ${COLORS.BG_HOVER};
    border-color: ${COLORS.PRIMARY};
  }
`

export const SC_QrHiddenInput = styled.input`
  display: none;
`

export const SC_QrVideoWrap = styled.div`
  position: relative;
  width: 100%;
  max-width: 320px;
  aspect-ratio: 1 / 1;
  margin: 0 auto;
  border-radius: 8px;
  overflow: hidden;
  background: ${COLORS.BLACK};
`

export const SC_QrVideo = styled.video`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`

export const SC_QrFrame = styled.div`
  position: absolute;
  inset: 14%;
  border: 2px solid ${COLORS.PRIMARY};
  border-radius: 8px;
  box-shadow: 0 0 0 9999px ${COLORS.OVERLAY_30};
  pointer-events: none;
`

export const SC_QrHint = styled.p`
  margin: 0;
  font-size: 13px;
  color: ${COLORS.TEXT_SECONDARY};
  text-align: center;
`

export const SC_QrError = styled.div`
  padding: 8px 12px;
  background: ${COLORS.RED_BG};
  border: 1px solid ${COLORS.RED_BORDER};
  border-radius: 6px;
  color: ${COLORS.DANGER};
  font-size: 13px;
`
