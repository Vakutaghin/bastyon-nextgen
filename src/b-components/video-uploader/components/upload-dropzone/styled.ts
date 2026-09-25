import styled from 'vue3-styled-components'
import Button from '@/components/button/button.vue'

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
  margin: 0 0 16px !important;
  font-size: 18px !important;
  font-weight: 600 !important;
  color: var(--color-text-primary) !important;
  width: 100% !important;
  box-sizing: border-box !important;
  display: block !important;
`

export const SC_DropZone = styled.div<{ uploading?: boolean; disabled?: boolean }>`
  border: 2px dashed var(--color-border-default) !important;
  border-radius: var(--ui-radius-lg) !important;
  padding: 48px 24px !important;
  text-align: center !important;
  background-color: var(--color-bg-input) !important;
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
    border-color: var(--color-ant-blue) !important;
    background-color: var(--color-bg-hover-blue) !important;
  }

  &.drag-over {
    border-color: var(--color-ant-blue) !important;
    background-color: var(--color-ant-blue-bg) !important;
    border-style: solid !important;
  }

  ${(p) =>
    p.uploading &&
    `
    border-color: var(--color-ant-blue) !important;
    background-color: var(--color-bg-hover-blue) !important;
    cursor: wait !important;
  `}

  ${(p) =>
    p.disabled &&
    `
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
    color: var(--color-text-primary) !important;
  }

  span {
    font-size: 16px !important;
    color: var(--color-text-secondary) !important;
  }
`

export const SC_ProgressText = styled.div`
  margin-top: 8px !important;
  font-size: 16px !important;
  font-weight: 500 !important;
  color: var(--color-ant-blue) !important;
`

export const SC_SecondaryButton = styled(Button)`
  margin-top: 8px;
`

export const SC_FileNameText = styled.div`
  margin-top: 8px;
  color: var(--color-text-secondary);
  font-size: 12px;
`

export const SC_ErrorText = styled.strong`
  color: var(--color-red-ant);
`
