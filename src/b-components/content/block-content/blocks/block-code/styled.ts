import styled from 'vue3-styled-components'

export const SC_BlockCode = styled.pre`
  margin: 1em 0;
  padding: 1em;
  background-color: var(--color-dark-bg);
  border-radius: var(--ui-radius-sm);
  overflow-x: auto;
  border: 1px solid var(--color-text-secondary);
`

export const SC_BlockCodeCode = styled.code`
  font-family: var(--font-family-mono);
  font-size: 0.9em;
  line-height: 1.5;
  color: var(--color-white);
  white-space: pre;
  word-wrap: normal;
  overflow-wrap: normal;
`
