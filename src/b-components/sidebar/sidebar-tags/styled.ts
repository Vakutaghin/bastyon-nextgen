import styled, { css } from 'vue3-styled-components'

const selectedProps = {
  selected: Boolean,
  // Вес тега для облака (1..5) — задаёт размер шрифта.
  weight: Number,
}

/** Размер шрифта по весу тега (бакеты 1..5). */
const TAG_WEIGHT_FONT: Record<number, string> = {
  1: '11px',
  2: '13px',
  3: '15px',
  4: '17px',
  5: '20px',
}

export const SC_Tags = styled.div``

export const SC_TagsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 11px;
  cursor: pointer;
`

export const SC_TagsControls = styled.div`
  margin-left: auto;
  margin-right: 8px;
`

export const SC_TagsReset = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: color 0.2s;

  &:hover {
    color: var(--color-text-primary);
  }
`

export const SC_TagsTitle = styled.h3`
  font-size: 12px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  margin: 0;
`

export const SC_TagsToggle = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: color 0.2s;

  &:hover {
    color: var(--color-text-primary);
  }
`

export const SC_TagsLoading = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80px;
  padding: 16px 0;
  color: var(--color-text-secondary);
`

export const SC_TagsList = styled.div`
  display: flex;
  flex-flow: row wrap;
  align-items: center;
  gap: 6px 8px;
`

export const SC_TagsCount = styled.span`
  font-size: 10px;
  color: var(--ui-text-muted);
  background: var(--ui-bg-accented);
  padding: 2px 4px;
  border-radius: var(--ui-radius-sm);
  font-weight: 500;
  flex-shrink: 0;
`

export const SC_TagsItem = styled('button', selectedProps)`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--ui-bg-elevated);
  border: 0;
  border-radius: var(--ui-radius-md);
  cursor: pointer;
  transition: background-color 0.15s;
  color: var(--ui-text);
  font-size: ${(props) => TAG_WEIGHT_FONT[props.weight as number] ?? '11px'};
  line-height: 1.2;
  font-weight: 500;

  &:hover {
    background: var(--ui-bg-accented);
    color: var(--ui-text-highlighted);
  }

  &:focus {
    outline: none;
  }

  ${(props) =>
    props.selected &&
    css`
      background: var(--ui-primary);
      color: var(--ui-text-inverted);

      &:hover {
        background: rgb(var(--ui-primary-rgb) / 75%);
        color: var(--ui-text-inverted);
      }

      ${SC_TagsCount} {
        background: var(--color-overlay-15);
        color: var(--ui-text-inverted);
      }
    `}
`

export const SC_TagsName = styled.span`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
`
