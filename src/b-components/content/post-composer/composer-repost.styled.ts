import styled from 'vue3-styled-components'

import { BORDER_RADIUS, FONT_SIZE, SPACING } from '@/styles/design-tokens'

export const SC_RepostPreview = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.SM};
  padding: ${SPACING.SM} ${SPACING.MD};
  border: 1px solid var(--color-border);
  border-radius: ${BORDER_RADIUS.MD};
  background: var(--color-bg-secondary);
`

export const SC_RepostHead = styled.div`
  display: flex;
  align-items: center;
  gap: ${SPACING.SM};
`

export const SC_RepostAuthor = styled.span`
  font-size: ${FONT_SIZE.MD};
  font-weight: 500;
  color: var(--color-text-primary);
`

export const SC_RepostBody = styled.div`
  font-size: ${FONT_SIZE.MD};
  line-height: 1.45;
  color: var(--color-text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
`

export const SC_RepostThumb = styled.img`
  width: 100%;
  max-height: 180px;
  object-fit: cover;
  border-radius: ${BORDER_RADIUS.SM};
`
