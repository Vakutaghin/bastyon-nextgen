import styled, { css } from 'vue3-styled-components'
import { TRANSITIONS } from '@/styles/design-tokens'

const langRowProps = { active: Boolean }

export const SC_GeneralBlock = styled.div`
  max-width: 640px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`

export const SC_GeneralRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
  border-bottom: 1px solid var(--color-overlay-6);

  &:last-child {
    border-bottom: none;
  }
`

export const SC_GeneralLabel = styled.span`
  font-size: 14px;
  color: var(--ui-text-highlighted);
`

/** Подпись с пояснением под ней. */
export const SC_GeneralText = styled.span`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`

export const SC_GeneralHint = styled.span`
  font-size: 12px;
  line-height: calc(1.4 * var(--leading-scale));
  color: var(--ui-text-muted);
`

/** Переключатель как вкладки-pill у Nuxt UI (UTabs): подложка elevated с
 * отступом, активный вариант — заливка акцентом. */
export const SC_LangSwitcher = styled.div`
  display: inline-flex;
  gap: 2px;
  padding: 4px;
  background: var(--ui-bg-elevated);
  border-radius: var(--ui-radius-lg);
`

export const SC_LangButton = styled('button', langRowProps)`
  padding: 4px 12px;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  background: transparent;
  color: var(--ui-text-muted);
  border: none;
  border-radius: var(--ui-radius-md);
  cursor: pointer;
  transition:
    background-color ${TRANSITIONS.QUICK},
    color ${TRANSITIONS.QUICK};

  &:hover {
    background: transparent;
    color: var(--ui-text-highlighted);
  }

  ${(p: { active?: boolean }) =>
    p.active &&
    css`
      background: var(--ui-primary);
      color: var(--ui-text-inverted);
      box-shadow: var(--ui-shadow-xs);

      &:hover {
        background: var(--ui-primary);
        color: var(--ui-text-inverted);
      }
    `}
`
