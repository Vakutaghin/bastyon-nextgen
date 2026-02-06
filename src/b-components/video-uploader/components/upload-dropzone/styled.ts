import styled from 'vue3-styled-components'

export const SC_UploadSection = styled.div`
  flex-shrink: 0 !important;
  padding: 16px !important;
  width: 100% !important;
  box-sizing: border-box !important;
  display: block !important;
  position: relative !important;
  min-width: 0 !important;

  &,
  & * {
    box-sizing: border-box !important;
  }
`

export const SC_SectionTitle = styled.h3`
  margin: 0 0 16px 0 !important;
  font-size: 18px !important;
  font-weight: 600 !important;
  color: #333 !important;
  width: 100% !important;
  box-sizing: border-box !important;
  display: block !important;
`

export const SC_DropZone = styled.div<{ uploading?: boolean; disabled?: boolean }>`
  border: 2px dashed #d9d9d9 !important;
  border-radius: 8px !important;
  padding: 48px 24px !important;
  text-align: center !important;
  background-color: #fafafa !important;
  transition: all 0.3s ease !important;
  cursor: pointer !important;
  min-height: 200px !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  width: 100% !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
  position: relative !important;
  overflow: visible !important;
  margin: 0 !important;
  flex-shrink: 0 !important;

  &:hover {
    border-color: #1890ff !important;
    background-color: #f0f7ff !important;
  }

  &.drag-over {
    border-color: #1890ff !important;
    background-color: #e6f7ff !important;
    border-style: solid !important;
  }

  ${(p) => p.uploading && `
    border-color: #1890ff !important;
    background-color: #f0f7ff !important;
    cursor: wait !important;
  `}

  ${(p) => p.disabled && `
    cursor: default !important;
    opacity: 0.7 !important;
  `}

  .ant-progress {
    width: 100% !important;
    max-width: 400px !important;
  }

  .ant-progress-text {
    display: none !important;
  }

  /* Убеждаемся, что все дочерние элементы наследуют стили */
  > * {
    box-sizing: border-box !important;
  }
`

export const SC_DropZoneText = styled.div`
  display: flex !important;
  flex-direction: column !important;
  gap: 8px !important;
  margin-bottom: 16px !important;

  strong {
    font-size: 16px !important;
    color: #333 !important;
  }

  span {
    font-size: 16px !important;
    color: #666 !important;
  }
`

export const SC_ProgressText = styled.div`
  margin-top: 8px !important;
  font-size: 16px !important;
  font-weight: 500 !important;
  color: #1890ff !important;
`
