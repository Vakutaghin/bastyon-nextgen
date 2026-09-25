import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

// UEmpty из Nuxt UI, вариант outline, размер md: фон страницы и кольцо, радиус 8;
// иконка 20px muted в круге 40px на elevated, заголовок 16/500 highlighted,
// подпись 14px muted.
export const SC_Empty = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  padding: 24px;
  border-radius: var(--ui-radius-lg);
  background: var(--ui-bg);
  box-shadow: inset 0 0 0 1px var(--ui-border);
  text-align: center;

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    padding: 16px;
  }
`

export const SC_EmptyAvatar = styled.div`
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  margin-bottom: 8px;
  border-radius: 50%;
  background: var(--ui-bg-elevated);
  color: var(--ui-text-muted);
  font-size: 20px;
`

export const SC_EmptyTitle = styled.div`
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
  color: var(--ui-text-highlighted);
`

export const SC_EmptyDescription = styled.div`
  max-width: 384px;
  font-size: 14px;
  line-height: 20px;
  color: var(--ui-text-muted);
  text-wrap: balance;
`
