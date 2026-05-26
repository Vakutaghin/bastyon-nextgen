import styled from 'vue3-styled-components'

export const SC_FileMessage = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 10px;
  width: 100%;
  max-width: min(320px, 100%);
  min-width: 0;
  box-sizing: border-box;
`

export const SC_FileIcon = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #00a4db;
  color: #fff;
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
  font-weight: 600;
  color: #263238;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
`

export const SC_FileMeta = styled.div`
  font-size: 12px;
  color: #607d8b;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
`

export const SC_DownloadButton = styled.button`
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
  font-size: 16px;
  color: #00a4db;

  &:hover:not(:disabled) {
    background: #f0f6fa;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

export const SC_Spinner = styled.div`
  width: 18px;
  height: 18px;
  border: 2px solid #cfd8dc;
  border-top-color: #00a4db;
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`

export const SC_Progress = styled.div`
  font-size: 11px;
  color: #00a4db;
  font-weight: 600;
`

export const SC_ErrorText = styled.div`
  font-size: 11px;
  color: #c62828;
`
