import styled from 'vue3-styled-components'

export const SC_BlockCode = styled.pre`
  margin: 1em 0;
  padding: 1em;
  background-color: rgba(var(--background-main, 1, 22, 33), 0.8);
  border-radius: 4px;
  overflow-x: auto;
  border: 1px solid rgba(var(--color-txt-gray, 100, 100, 100), 0.2);
`

export const SC_BlockCodeCode = styled.code`
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.9em;
  line-height: 1.5;
  color: rgb(var(--text-color, 255, 255, 255));
  white-space: pre;
  word-wrap: normal;
  overflow-wrap: normal;
`
