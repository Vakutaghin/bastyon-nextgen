import styled from 'vue3-styled-components'

export const SC_BlockQuote = styled.blockquote`
  margin: 1em 0;
  padding: 1em 1.5em;
  border-left: 4px solid rgb(0, 123, 255);
  background-color: rgba(248, 249, 250, 0.8);
  font-style: italic;
  color: rgb(33, 37, 41) !important;
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;
`

export const SC_BlockQuoteContent = styled.div`
  line-height: 1.6;
  margin-bottom: 0.5em;
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

export const SC_BlockQuoteCaption = styled.footer`
  font-size: 0.9em;
  text-align: right;
  color: rgb(108, 117, 125) !important;
  font-style: normal;
`
