import styled from 'vue3-styled-components'

export const SC_FileMessage = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--color-overlay-3);
  border-radius: var(--ui-radius-lg);
  width: 100%;
  max-width: min(320px, 100%);
  min-width: 0;
  box-sizing: border-box;
`

export const SC_FileIcon = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--ui-primary);
  color: var(--ui-text-inverted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;
`

export const SC_FileBody = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1 1 auto;
`

export const SC_FileName = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-text-highlighted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
`

export const SC_FileMeta = styled.div`
  font-size: 12px;
  color: var(--color-blue-gray);
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
`

export const SC_DownloadButton = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--color-border);
  background: var(--color-bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  font-size: 16px;
  color: var(--ui-primary);

  &:hover:not(:disabled) {
    background: var(--color-bg-hover-blue);
  }

  &:disabled {
    opacity: 0.75;
    cursor: not-allowed;
  }
`

export const SC_Spinner = styled.div`
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-bg-tertiary);
  border-top-color: var(--ui-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite; /* @keyframes spin — глобально в style.css */
`

export const SC_Progress = styled.div`
  font-size: 12px;
  color: var(--ui-primary);
  font-weight: 500;
`

export const SC_ErrorText = styled.div`
  font-size: 12px;
  color: var(--color-red-dark);
`
