import styled from 'vue3-styled-components'
import { TRANSITIONS } from '@/styles/design-tokens'

export const SC_List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 60vh;
  overflow-y: auto;
  padding: 4px 0;
`

export const SC_Row = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border-radius: var(--ui-radius-lg);
  transition: background ${TRANSITIONS.FAST};

  &:hover {
    background: var(--color-bg-hover);
  }
`

export const SC_RowMain = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
`

export const SC_Avatar = styled.div`
  width: 40px;
  height: 40px;
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

export const SC_RowInfo = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`

export const SC_RowName = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const SC_RowMeta = styled.span`
  font-size: 12px;
  color: var(--color-text-muted);
`

export const SC_FollowBtn = styled.button`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: var(--ui-radius-md);
  border: 1px solid var(--color-primary);
  background: var(--color-primary);
  color: var(--color-white);
  font-size: 13px;
  cursor: pointer;
  transition: background ${TRANSITIONS.FAST};

  &:hover:not(:disabled) {
    background: var(--color-primary-hover);
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }

  &.subscribed {
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    border-color: var(--color-border-default);
  }
`

export const SC_State = styled.div`
  padding: 28px 0;
  text-align: center;
  font-size: 14px;
  color: var(--color-text-secondary);
`

export const SC_LoadMore = styled.button`
  margin: 8px auto 0;
  display: block;
  padding: 8px 18px;
  border-radius: var(--ui-radius-md);
  border: 1px solid var(--color-border-default);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: background ${TRANSITIONS.FAST};

  &:hover {
    background: var(--color-bg-hover);
  }
`
