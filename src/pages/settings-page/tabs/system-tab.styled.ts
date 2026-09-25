import styled from 'vue3-styled-components'

export const SC_SystemSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 28px;
`

export const SC_SystemRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-border-lighter);

  &:last-child {
    border-bottom: 0;
  }
`

export const SC_SystemLabel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`

export const SC_SystemTitle = styled.span`
  font-size: 14px;
  color: var(--color-text-primary);
`

export const SC_SystemHint = styled.span`
  font-size: 12px;
  color: var(--color-text-secondary);
`

export const SC_ScaleRow = styled.div`
  display: inline-flex;
  flex-shrink: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
`

const scaleProps = { active: Boolean }

export const SC_ScaleButton = styled('button', scaleProps)`
  padding: 5px 12px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: ${(p) => (p.active ? 'var(--color-primary)' : 'transparent')};
  color: ${(p) => (p.active ? 'var(--color-white)' : 'var(--color-text-secondary)')};
  transition: background-color var(--transition-fast);

  & + & {
    border-left: 1px solid var(--color-border);
  }

  &:hover {
    background: ${(p) => (p.active ? 'var(--color-primary)' : 'var(--color-overlay-8)')};
    color: ${(p) => (p.active ? 'var(--color-white)' : 'var(--color-text-primary)')};
  }
`

export const SC_DangerButton = styled.button`
  flex-shrink: 0;
  background: transparent;
  color: var(--color-danger);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-md);
  padding: 6px 16px;
  font-size: 13px;
  cursor: pointer;
  transition: background-color var(--transition-fast);

  &:hover:not(:disabled) {
    background: var(--color-danger-bg-soft);
    color: var(--color-danger);
  }

  &:disabled {
    cursor: default;
    opacity: 0.6;
  }
`
