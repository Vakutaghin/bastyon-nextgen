import styled, { css } from 'vue3-styled-components'

const tabProps = {
  active: Boolean,
  disabled: Boolean
}

export const SC_Tabs = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgb(248, 249, 250);

  &.collapsed {
    padding-bottom: 12px;
    border-bottom-color: rgba(206, 212, 218, 0.3);
  }

  &.collapsed button {
    justify-content: center;
    padding: 10px;
  }
`

export const SC_TabsItem = styled('button', tabProps)`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11.25px 15px;
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
  width: 100%;

  /* Target both AntD icon wrapper and potential direct SVGs */
  & > .anticon, & > svg {
    font-size: 16px;
    width: 20px;
    flex-shrink: 0;
  }

  &:hover {
    background: rgb(248, 249, 250);
    color: rgb(0, 123, 255);
  }

  ${props => props.active && css`
    background: rgba(0, 123, 255, 0.1);
    color: rgb(0, 123, 255);
    font-weight: 600;

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 3px;
      height: 60%;
      background: rgb(0, 123, 255);
      border-radius: 0 2px 2px 0;
    }

    &:hover {
      background: rgba(0, 123, 255, 0.15);
    }
  `}

  ${props => props.disabled && css`
    cursor: not-allowed;
    color: rgb(173, 181, 189);
    opacity: 0.6;

    &:hover {
      background: none;
      color: rgb(173, 181, 189);
    }
  `}
`

export const SC_TabsLabel = styled.span`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
`
