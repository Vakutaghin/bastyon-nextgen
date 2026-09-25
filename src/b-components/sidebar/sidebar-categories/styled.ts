import styled, { css } from 'vue3-styled-components'

const activeProps = {
  active: Boolean,
}

const selectedProps = {
  selected: Boolean,
}

const excludedProps = {
  excluded: Boolean,
}

export const SC_Categories = styled.div`
  margin-bottom: 23px;
`

export const SC_CategoriesHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 11px;
  cursor: pointer;
`

export const SC_CategoriesTitle = styled.h3`
  font-size: 12px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  margin: 0;
`

export const SC_CategoriesToggle = styled.button`
  background: none;
  border: none;
  color: var(--color-text-primary);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  transition: all var(--transition-normal);

  &:hover {
    opacity: 0.7;
  }
`

export const SC_CategoriesControls = styled.div`
  display: flex;
  gap: 8px;
  margin-left: auto;
  margin-right: 8px;
`

export const SC_ControlBtn = styled('button', activeProps)`
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
  border-radius: var(--ui-radius-sm);

  &:hover {
    color: var(--color-text-primary);
    background: var(--color-overlay-5);
  }

  ${(props) =>
    props.active &&
    css`
      color: var(--color-primary);
    `}
`

export const SC_CategoriesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`

/** Категория — пункт навигации в оформлении Nuxt UI, как SC_TabsItem. */
export const SC_CategoriesItem = styled('div', selectedProps)`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: var(--ui-radius-md);
  background: none;
  border: none;
  cursor: pointer;
  transition:
    background-color var(--transition-quick),
    color var(--transition-quick);
  color: var(--ui-text-muted);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-align: left;
  position: relative;
  opacity: 1;

  &:hover {
    background: rgb(var(--ui-bg-elevated-rgb) / 50%);
    color: var(--ui-text-highlighted);
  }

  ${(props) =>
    props.selected &&
    css`
      background: var(--ui-bg-elevated);
      color: var(--ui-primary);

      &:hover {
        background: var(--ui-bg-elevated);
        color: var(--ui-primary);
      }
    `}
`

export const SC_CategoriesIcon = styled('span', selectedProps)`
  font-size: 16px;
  width: 18px;
  text-align: center;
  flex-shrink: 0;
`

export const SC_CategoriesName = styled('span', selectedProps)`
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const SC_TopFirstWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  gap: 12px;
`

export const SC_TopFirstLabel = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_CategoryRemoveBtn = styled.div`
  margin-left: auto;
  padding: 0 5px;
  opacity: 0.6;
  cursor: pointer;
`

export const SC_ModalHint = styled.div`
  margin-bottom: 10px;
  font-size: 14px;
  color: var(--color-gray-888);
`

export const SC_DeleteConfirmRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
`
