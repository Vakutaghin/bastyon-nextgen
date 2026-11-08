import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_DownloadsButton = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  border-radius: var(--ui-radius-md);
  color: var(--color-text-primary);
  font-size: 20px;
  cursor: pointer;
  transition: background-color var(--transition-fast);

  &:hover {
    background-color: var(--ui-bg-elevated);
  }

  &.active {
    color: var(--ui-primary);
  }

  &:focus-visible {
    outline: 2px solid var(--ui-primary);
    outline-offset: 2px;
  }
`

/** Сколько качается сейчас — маленькое число в углу значка. */
export const SC_DownloadsCount = styled.span`
  position: absolute;
  top: 0;
  right: 0;
  min-width: 16px;
  padding: 0 4px;
  border-radius: var(--ui-radius-full);
  background: var(--ui-primary);
  color: var(--ui-text-inverted);
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  text-align: center;
`

export const SC_DownloadsMenu = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 320px;
  max-width: 400px;
  max-height: 80vh;
  padding: 8px;
  overflow-y: auto;
  border-radius: var(--ui-radius-md);
  background: var(--ui-bg);
  box-shadow:
    0 0 0 1px var(--ui-border),
    var(--ui-shadow-lg);

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    min-width: 0;
    width: calc(100vw - 32px);
  }
`

export const SC_DownloadsHead = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px 2px;
  color: var(--color-text-secondary);
`

export const SC_DownloadsTitle = styled.div`
  flex: 1;
  font-size: 14px;
  font-weight: 600;
`

export const SC_DownloadsList = styled.div`
  display: flex;
  flex-direction: column;
`

export const SC_DownloadRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: var(--ui-radius-md);

  &:hover {
    background: var(--color-bg-tertiary);
  }
`

export const SC_DownloadKind = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: var(--ui-radius-md);
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  font-size: 16px;
`

export const SC_DownloadInfo = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`

export const SC_DownloadName = styled.div`
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SC_DownloadStatus = styled.div`
  color: var(--color-text-secondary);
  font-size: 12px;
`

export const SC_DownloadProgress = styled.progress`
  width: 100%;
  height: 4px;
  overflow: hidden;
  border: none;
  border-radius: var(--ui-radius-xs);
  background: var(--color-bg-hover);
  accent-color: var(--ui-primary);
  appearance: none;

  &::-webkit-progress-bar {
    background: var(--color-bg-hover);
  }

  &::-webkit-progress-value {
    background: var(--ui-primary);
  }

  &::-moz-progress-bar {
    background: var(--ui-primary);
  }
`

export const SC_DownloadActions = styled.div`
  display: flex;
  flex-shrink: 0;
  gap: 2px;
`

export const SC_IconButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: none;
  border-radius: var(--ui-radius-full);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 16px;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
  }

  &:disabled {
    cursor: default;
    opacity: 0.6;
  }
`

export const SC_DownloadsWhere = styled.p`
  margin: 0;
  padding: 8px 8px 0;
  border-top: 1px solid var(--color-bg-hover);
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.4;
`

export const SC_FooterLink = styled.button`
  align-self: flex-start;
  margin: 0 8px 4px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--ui-primary);
  font-size: 13px;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
`
