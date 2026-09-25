import styled from 'vue3-styled-components'
import { TRANSITIONS } from '@/styles/design-tokens'

export const SC_ShareMenu = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 200px;
  padding: 6px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-default);
  border-radius: var(--ui-radius-lg);
  box-shadow: var(--shadow-md);
`

export const SC_ShareItem = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 10px;
  border: none;
  border-radius: var(--ui-radius-md);
  background: none;
  color: var(--color-text-primary);
  font-size: 14px;
  cursor: pointer;
  text-align: left;
  transition: background ${TRANSITIONS.FAST};

  &:hover {
    background: var(--color-bg-hover);
  }

  &.share-item--danger {
    color: var(--color-danger);
  }

  .anticon {
    font-size: 16px;
  }
`

export const SC_ShareIcon = styled('span', { color: String })`
  display: inline-flex;
  width: 18px;
  justify-content: center;
  color: ${(p) => p.color || 'currentColor'};
`

export const SC_ShareDivider = styled.div`
  height: 1px;
  margin: 4px 6px;
  background: var(--color-border-lighter);
`
