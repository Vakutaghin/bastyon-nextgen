import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_FileMessage = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: ${COLORS.OVERLAY_3};
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
  background: ${COLORS.BRAND_CYAN};
  color: ${COLORS.WHITE};
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
  color: ${COLORS.TEXT_PRIMARY};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
`

export const SC_FileMeta = styled.div`
  font-size: 12px;
  color: ${COLORS.BLUE_GRAY};
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
`

export const SC_DownloadButton = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid ${COLORS.BORDER};
  background: ${COLORS.BG_PRIMARY};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  font-size: 16px;
  color: ${COLORS.BRAND_CYAN};

  &:hover:not(:disabled) {
    background: ${COLORS.BG_HOVER_BLUE};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

export const SC_Spinner = styled.div`
  width: 18px;
  height: 18px;
  border: 2px solid ${COLORS.BG_TERTIARY};
  border-top-color: ${COLORS.BRAND_CYAN};
  border-radius: 50%;
  animation: spin 1s linear infinite; /* @keyframes spin — глобально в style.css */
`

export const SC_Progress = styled.div`
  font-size: 11px;
  color: ${COLORS.BRAND_CYAN};
  font-weight: 600;
`

export const SC_ErrorText = styled.div`
  font-size: 11px;
  color: ${COLORS.RED_DARK};
`
