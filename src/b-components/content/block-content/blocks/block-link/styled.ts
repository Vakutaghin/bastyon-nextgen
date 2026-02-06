import styled from 'vue3-styled-components'

export const SC_BlockLink = styled.a`
  color: rgb(var(--color-txt-ac, 0, 164, 255));
  text-decoration: none;
  word-break: break-all;

  &:hover {
    text-decoration: underline;
  }
`
