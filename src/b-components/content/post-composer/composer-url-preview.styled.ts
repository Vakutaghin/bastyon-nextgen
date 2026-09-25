import styled from 'vue3-styled-components'

import { FONT_SIZE, SPACING } from '@/styles/design-tokens'

export const SC_EmbedWrap = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: var(--ui-radius-lg);
  overflow: hidden;
  background: var(--color-black);

  & iframe {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
  }
`

export const SC_VideoBadge = styled.div`
  display: flex;
  align-items: center;
  gap: ${SPACING.SM};
  padding: ${SPACING.SM} ${SPACING.MD};
  font-size: ${FONT_SIZE.MD};
  color: var(--color-text-secondary);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--ui-radius-lg);
`
