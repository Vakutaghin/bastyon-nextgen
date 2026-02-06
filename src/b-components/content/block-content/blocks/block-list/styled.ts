import styled from 'vue3-styled-components'

export const SC_BlockList = styled.ul<{ style?: 'ordered' | 'unordered' }>`
  margin: 0.75em 0;
  padding-left: 1.5em;
  line-height: 1.6;
  color: rgb(33, 37, 41) !important;
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;

  ${(p) => {
    const style = p.style || 'unordered'
    return style === 'ordered'
      ? 'list-style-type: decimal;'
      : 'list-style-type: disc;'
  }}
`

export const SC_BlockListItem = styled.li`
  margin: 0.25em 0;
  color: rgb(33, 37, 41) !important;
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;

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
