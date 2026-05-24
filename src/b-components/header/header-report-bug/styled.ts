import styled from 'vue3-styled-components'

export const SC_ReportBugWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  transition: background-color 0.2s;
  color: var(--text-primary, #000);

  &:hover {
    background-color: rgba(0, 0, 0, 0.04);
  }
`
