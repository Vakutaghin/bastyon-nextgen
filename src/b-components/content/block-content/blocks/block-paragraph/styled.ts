import styled from 'vue3-styled-components'

export const SC_BlockParagraph = styled.p`
  margin: 0.75em 0;
  line-height: 1.6;
  color: var(--color-text-primary) !important;
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;

  &:first-child {
    margin-top: 0;
  }

  &:last-child {
    margin-bottom: 0;
  }

  * {
    color: var(--color-text-primary) !important;
  }

  .bastyon-link {
    color: var(--color-primary) !important;
    text-decoration: underline;
    cursor: pointer;
    word-break: break-all;
    overflow-wrap: break-word;
    word-wrap: break-word;
  }

  .bastyon-link:hover {
    color: var(--color-primary-active) !important;
    text-decoration: underline;
  }
`
