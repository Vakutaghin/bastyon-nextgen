import styled from 'vue3-styled-components'

export const SC_Status = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 48px;
  padding: 12px 0;
  font-size: 14px;
  color: var(--ui-text-muted);
  text-align: center;

  .sentinel {
    position: absolute;
    top: 0;
    width: 1px;
    height: 1px;
  }
`
