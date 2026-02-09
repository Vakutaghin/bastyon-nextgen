import styled from 'vue3-styled-components'


export const SC_MessengerButton = styled('button', { isOpen: Boolean })`
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background-color: #00A3F7;
  color: white;
  border: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: transform 0.2s, background-color 0.2s;
  z-index: 1001;
  pointer-events: auto;

  &:hover {
    transform: scale(1.05);
    background-color: #0088d1;
  }

  &:active {
    transform: scale(0.95);
  }

  img {
    width: 28px;
    height: 28px;
    ${(props: any) => !props.isOpen ? `
      position: relative;
      top: 2px;
      left: 0;
    ` : ''}
  }
`

export const SC_UnreadBadge = styled.span`
  position: absolute;
  top: -4px;
  right: -4px;
  background-color: #ff3b30;
  color: white;
  font-size: 12px;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 10px;
  border: 2px solid white;
  min-width: 20px;
  text-align: center;
`
