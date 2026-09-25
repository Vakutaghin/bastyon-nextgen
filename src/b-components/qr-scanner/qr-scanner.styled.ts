import styled from 'vue3-styled-components'
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
  border: 1px solid var(--color-border-default);
  border-radius: var(--ui-radius-md);
  cursor: pointer;
  font-size: 14px;
  color: var(--color-text-primary);
  background: var(--color-bg-secondary);
  transition:
    background ${TRANSITIONS.FAST},
    border-color ${TRANSITIONS.FAST};

  &:hover {
    background: var(--color-bg-hover);
    border-color: var(--color-primary);
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
  border-radius: var(--ui-radius-lg);
  overflow: hidden;
  background: var(--color-black);
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
  border: 2px solid var(--color-primary);
  border-radius: var(--ui-radius-lg);
  box-shadow: 0 0 0 9999px var(--color-overlay-30);
  pointer-events: none;
`

export const SC_QrHint = styled.p`
  margin: 0;
  font-size: 14px;
  color: var(--color-text-secondary);
  text-align: center;
`

export const SC_QrError = styled.div`
  padding: 8px 12px;
  background: var(--color-red-bg);
  border: 1px solid var(--color-red-border);
  border-radius: var(--ui-radius-md);
  color: var(--color-danger);
  font-size: 14px;
`
