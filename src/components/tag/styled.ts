import styled from 'vue3-styled-components'
import { noSelect } from '@/styles/chrome-styles'

// Тег в оформлении Nuxt UI — нейтральный бейдж (UBadge, soft): подложка
// elevated, 12px/500, радиус 6, на наведении — accented.
//
// Части для styled родителя: .ui-tag.
export const SC_Tag = styled.span`
  ${noSelect}
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  padding: 4px 8px;
  border: 0;
  border-radius: var(--ui-radius-md);
  background: var(--ui-bg-elevated);
  color: var(--ui-text);
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  white-space: nowrap;
  transition: background-color var(--transition-quick);

  &:hover {
    background: var(--ui-bg-accented);
  }
`
