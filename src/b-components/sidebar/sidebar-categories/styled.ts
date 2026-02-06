import styled, { css } from 'vue3-styled-components'

const activeProps = {
  active: Boolean
}

const selectedProps = {
  selected: Boolean
}

const excludedProps = {
  excluded: Boolean
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
  font-size: 13px;
  font-weight: 600;
  color: rgb(33, 37, 41);
  text-transform: uppercase;
  margin: 0;
`

export const SC_CategoriesToggle = styled.button`
  background: none;
  border: none;
  color: rgb(33, 37, 41);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  transition: all 0.3s;

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
  color: rgb(108, 117, 125);
  transition: all 0.2s;
  border-radius: 4px;

  &:hover {
    color: rgb(33, 37, 41);
    background: rgba(0, 0, 0, 0.05);
  }

  ${props => props.active && css`
    color: rgb(0, 123, 255);
  `}
`

export const SC_CategoriesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
`

export const SC_CategoriesItem = styled('div', selectedProps)`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
  border-radius: 8px;
  background: none;
  border: none;
  cursor: pointer;
  transition: all 0.3s;
  color: rgb(33, 37, 41);
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  position: relative;
  opacity: 1;

  &:hover {
    background: rgb(248, 249, 250);
  }

  ${props => props.selected && css`
    background: rgba(0, 123, 255, 0.1);
    color: rgb(0, 123, 255);
    font-weight: 600;

    &:hover {
      background: rgba(0, 123, 255, 0.15);
    }
  `}
`

export const SC_CategoriesIcon = styled('span', selectedProps)`
  font-size: 15px;
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
  font-size: 13px;
  font-weight: 600;
  color: rgb(33, 37, 41);
  text-transform: uppercase;
`
