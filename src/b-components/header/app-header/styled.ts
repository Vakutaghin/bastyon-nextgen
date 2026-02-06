import styled from 'vue3-styled-components'

export const SC_Header = styled.header`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 60px;
  background: rgb(255, 255, 255);
  border-bottom: 1px solid rgba(206, 212, 218, 0.3);
  z-index: 1000;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
`

export const SC_Sections = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 100%;
  padding: 0 20px;
  max-width: 1600px;
  margin: 0 auto;
`

export const SC_MessengerWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  transition: background-color 0.2s;
  color: var(--text-primary, #000);

  &:hover {
    background-color: rgba(0, 0, 0, 0.04);
  }
`

export const SC_Right = styled.div`
  display: flex;
  align-items: center;
  height: 100%;
  flex: 0 0 auto;
  gap: 10px;
  margin-left: 20px;
`
