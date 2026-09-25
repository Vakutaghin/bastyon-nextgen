import styled from 'vue3-styled-components'
import { TRANSITIONS } from '@/styles/design-tokens'

export const SC_RecRoot = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 24px;
`

export const SC_RecCaption = styled.div`
  font-weight: 600;
  font-size: 14px;
  color: var(--ui-text-highlighted);
  margin-bottom: 12px;
`

export const SC_RecList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

export const SC_RecRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 4px;
  border-radius: var(--ui-radius-lg);
  transition: background ${TRANSITIONS.FAST};

  &:hover {
    background: var(--color-bg-hover);
  }
`

export const SC_RecMain = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
`

export const SC_RecAvatar = styled.div`
  width: 34px;
  height: 34px;
  border-radius: 50%;
  flex-shrink: 0;
  overflow: hidden;
  background: var(--color-bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: var(--color-text-secondary);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

export const SC_RecInfo = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`

export const SC_RecName = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-text-highlighted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const SC_RecMeta = styled.span`
  font-size: 11px;
  color: var(--color-text-muted);
`

export const SC_RecFollow = styled.button`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border-radius: var(--ui-radius-md);
  border: 0;
  background: var(--ui-primary);
  color: var(--ui-text-inverted);
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  cursor: pointer;
  transition: background ${TRANSITIONS.FAST};

  &:hover:not(:disabled) {
    background: rgb(var(--ui-primary-rgb) / 75%);
    color: var(--ui-text-inverted);
  }

  &:disabled {
    opacity: 0.75;
    cursor: not-allowed;
  }
`

export const SC_RecState = styled.div`
  font-size: 13px;
  color: var(--color-text-secondary);
  padding: 8px 0;
`
