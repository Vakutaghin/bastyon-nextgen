import styled from 'vue3-styled-components'
import Button from '@/components/button/button.vue'

export const SC_UploadSection = styled.div`
  flex-shrink: 0;
  padding: 16px;
  width: 100%;
  box-sizing: border-box;
  display: block;
  position: relative;
  min-width: 0;

  &,
  & * {
    box-sizing: border-box;
  }
`

export const SC_SectionTitle = styled.h3`
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  width: 100%;
  box-sizing: border-box;
  display: block;
`

export const SC_DropZone = styled.div<{ uploading?: boolean; disabled?: boolean }>`
  border: 2px dashed var(--color-border-default);
  border-radius: var(--ui-radius-lg);
  padding: 48px 24px;
  text-align: center;
  background-color: var(--color-bg-input);
  transition: all var(--transition-normal);
  cursor: pointer;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  position: relative;
  overflow: visible;
  margin: 0;
  flex-shrink: 0;

  &:hover {
    border-color: var(--ui-primary);
    background-color: var(--color-bg-hover-blue);
  }

  &.drag-over {
    border-color: var(--ui-primary);
    background-color: rgb(var(--ui-primary-rgb) / 10%);
    border-style: solid;
  }

  ${(p) =>
    p.uploading &&
    `
    border-color: var(--ui-primary);
    background-color: var(--color-bg-hover-blue);
    cursor: wait;
  `}

  ${(p) =>
    p.disabled &&
    `
    cursor: default;
    opacity: 0.7;
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
    box-sizing: border-box;
  }
`

export const SC_DropZoneText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;

  strong {
    font-size: 16px;
    color: var(--color-text-primary);
  }

  span {
    font-size: 16px;
    color: var(--color-text-secondary);
  }
`

export const SC_ProgressText = styled.div`
  margin-top: 8px;
  font-size: 16px;
  font-weight: 500;
  color: var(--ui-primary);
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
