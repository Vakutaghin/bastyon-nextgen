import styled from 'vue3-styled-components'

// Опрос в посте в духе Nuxt UI: рамка default, радиус 8; вариант — кнопка
// с рамкой accented, в итогах — полоска доли под текстом, выбранный вариант
// отмечен акцентом.
export const SC_Poll = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 12px 0;
  padding: 16px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
`

export const SC_Question = styled.div`
  display: flex;
  gap: 8px;
  align-items: flex-start;
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
  color: var(--ui-text-highlighted);
  overflow-wrap: anywhere;

  .anticon {
    flex-shrink: 0;
    margin-top: 2px;
    font-size: 18px;
    color: var(--ui-primary);
  }
`

export const SC_Options = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const SC_Option = styled.button`
  position: relative;
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
  min-height: 40px;
  padding: 8px 12px;
  overflow: hidden;
  font: inherit;
  font-size: 14px;
  color: var(--ui-text-highlighted);
  text-align: start;
  cursor: pointer;
  background: var(--ui-bg);
  border: 1px solid var(--ui-border-accented);
  border-radius: var(--ui-radius-md);
  transition:
    border-color var(--transition-quick),
    background-color var(--transition-quick);

  &:hover:not(:disabled, .results) {
    background: var(--ui-bg-elevated);
  }

  &:focus-visible {
    outline: 2px solid var(--ui-primary);
    outline-offset: 2px;
  }

  &.results,
  &.idle,
  &:disabled {
    cursor: default;
  }

  &.chosen {
    border-color: var(--ui-primary);
  }

  .anticon {
    position: relative;
    flex-shrink: 0;
    font-size: 16px;
    color: var(--ui-primary);
  }
`

/** Доля варианта — полоска под текстом. */
export const SC_Bar = styled('span', { share: String })`
  position: absolute;
  inset: 0 auto 0 0;
  width: ${(p) => p.share || '0%'};
  background: var(--ui-bg-elevated);
  transition: width var(--transition-normal);

  .chosen > & {
    background: rgb(var(--ui-primary-rgb) / 12%);
  }
`

export const SC_OptionText = styled.span`
  position: relative;
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
`

export const SC_Percent = styled.span`
  position: relative;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  color: var(--ui-text-muted);
`

export const SC_Footer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  font-size: 13px;
  color: var(--ui-text-muted);
`

export const SC_Note = styled.span`
  color: var(--ui-text-dimmed);
`
