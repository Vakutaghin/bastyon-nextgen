import styled from 'vue3-styled-components'

export const SC_BlockParagraph = styled.p`
  margin: 0.75em 0;
  line-height: 1.6;
  color: rgb(33, 37, 41) !important;
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;

  &:first-child {
    margin-top: 0;
  }

  &:last-child {
    margin-bottom: 0;
  }

  :deep(*) {
    color: rgb(33, 37, 41) !important;
  }

  :deep(.bastyon-link) {
    color: rgb(0, 123, 255) !important;
    text-decoration: underline;
    cursor: pointer;
    word-break: break-all;
    overflow-wrap: break-word;
    word-wrap: break-word;
  }

  :deep(.bastyon-link:hover) {
    color: rgb(0, 86, 179) !important;
    text-decoration: underline;
  }
`
