import styled from 'vue3-styled-components'

export const SC_AttachmentRoot = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
`

export const SC_AttachButton = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid #cfd8dc;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  font-size: 18px;
  line-height: 1;
  color: #607d8b;

  &:hover {
    background: #f0f6fa;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

export const SC_Menu = styled.div`
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  background: #fff;
  border: 1px solid #e0e6eb;
  border-radius: 10px;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.08);
  padding: 6px;
  min-width: 160px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 2px;
`

export const SC_MenuItem = styled.button`
  background: none;
  border: 0;
  text-align: left;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #263238;

  &:hover:not(:disabled) {
    background: #f0f6fa;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`

export const SC_HiddenInput = styled.input`
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
`
