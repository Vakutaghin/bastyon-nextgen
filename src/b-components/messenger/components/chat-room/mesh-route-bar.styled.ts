import styled from 'vue3-styled-components'

export const SC_MeshRouteBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  flex-shrink: 0;
  padding: 6px 16px;
  border-top: 1px solid var(--ui-border);
  font-size: 12px;
  color: var(--ui-text-muted);
  background: var(--ui-bg-elevated);
`

export const SC_MeshRouteText = styled.span`
  flex: 1 1 auto;
  min-width: 0;
`

export const SC_MeshRouteAction = styled.button`
  flex-shrink: 0;
  padding: 3px 10px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-full);
  font-size: 12px;
  font-weight: 500;
  color: var(--ui-primary);
  background: var(--ui-bg);
  cursor: pointer;

  &:hover {
    background: var(--ui-bg-elevated);
  }
`
