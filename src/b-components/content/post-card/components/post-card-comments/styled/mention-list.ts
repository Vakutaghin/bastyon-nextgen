import styled from 'vue3-styled-components'

/** Кого упомянуть; место у поля ставит v-anchored. */
export const SC_MentionList = styled.div`
  position: absolute;
  max-height: min(180px, var(--ui-floating-available-height, 180px));
  overflow-y: auto;
  background: var(--color-bg-primary);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  box-shadow: var(--shadow-md);
  z-index: 10;
`

export const SC_MentionItem = styled.button`
  display: block;
  width: 100%;
  padding: 8px 14px;
  border: none;
  background: none;
  text-align: left;
  font-size: 14px;
  color: var(--color-text-primary);
  cursor: pointer;

  &:hover {
    background: var(--color-bg-hover);
  }

  &.mention-item--highlighted {
    background: rgb(var(--ui-primary-rgb) / 8%);
  }
`
