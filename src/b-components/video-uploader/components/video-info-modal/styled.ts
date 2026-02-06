import styled from 'vue3-styled-components'

export const SC_InfoContent = styled.div`
  display: flex !important;
  flex-direction: column !important;
  gap: 16px !important;
`

export const SC_InfoRow = styled.div`
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  padding: 8px 0 !important;
  border-bottom: 1px solid #f0f0f0 !important;

  &:last-child {
    border-bottom: none !important;
  }
`

export const SC_InfoLabel = styled.div`
  font-weight: 500 !important;
  color: #666 !important;
  font-size: 16px !important;
`

export const SC_InfoValue = styled.div`
  color: #333 !important;
  font-size: 16px !important;
  text-align: right !important;
  word-break: break-word !important;
  max-width: 60% !important;
`
