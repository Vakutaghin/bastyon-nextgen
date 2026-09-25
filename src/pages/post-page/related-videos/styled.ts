import styled from 'vue3-styled-components'
import { TRANSITIONS } from '@/styles/design-tokens'

export const SC_Related = styled.section`
  margin-top: 20px;
`

export const SC_RelatedTitle = styled.h2`
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
`

export const SC_RelatedList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

export const SC_RelatedItem = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: var(--ui-radius-lg);
  background: none;
  cursor: pointer;
  text-align: left;
  transition: background ${TRANSITIONS.FAST};

  &:hover {
    background: var(--color-bg-hover);
  }
`

export const SC_RelatedThumb = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: var(--ui-radius-lg);
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  font-size: 18px;
`

export const SC_RelatedInfo = styled.span`
  display: flex;
  flex-direction: column;
  min-width: 0;
`

export const SC_RelatedName = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const SC_RelatedMeta = styled.span`
  font-size: 12px;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`
