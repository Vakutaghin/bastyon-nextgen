import styled from 'vue3-styled-components'
import { Z_INDEX, TRANSITIONS } from '@/styles/design-tokens'

export const SC_QrFrame = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-lighter);
  border-radius: var(--ui-radius-lg);
  cursor: zoom-in;
  transition:
    border-color ${TRANSITIONS.QUICK},
    box-shadow ${TRANSITIONS.QUICK};

  &:hover {
    border-color: var(--color-primary-light-50);
    box-shadow: 0 4px 10px var(--color-overlay-8);
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
  background: var(--color-overlay-55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: ${Z_INDEX.MODAL};
  cursor: zoom-out;
`

export const SC_QrModalCard = styled.div`
  background: var(--color-bg-primary);
  border-radius: var(--ui-radius-lg);
  padding: 24px;
  max-width: 90vw;
  box-shadow: 0 10px 40px var(--color-overlay-25);
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
  font-family: var(--font-family-mono);
  font-size: 13px;
  color: var(--color-text-primary);
  word-break: break-all;
  max-width: 320px;
  margin-left: auto;
  margin-right: auto;
`

export const SC_QrPlaceholder = styled.div`
  width: 84px;
  height: 84px;
  background: var(--color-bg-disabled);
  border-radius: var(--ui-radius-sm);
`
