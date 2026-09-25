import styled from 'vue3-styled-components'

export const SC_BlockQuote = styled.blockquote`
  margin: 1em 0;
  padding: 1em 1.5em;
  border-left: 4px solid var(--color-primary);
  background-color: var(--color-surface-frosted);
  font-style: italic;
  color: var(--color-text-primary) !important;
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;
`

export const SC_BlockQuoteContent = styled.div`
  line-height: 1.6;
  margin-bottom: 0.5em;
  color: var(--color-text-primary) !important;
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;

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

export const SC_BlockQuoteCaption = styled.footer`
  font-size: 0.9em;
  text-align: right;
  color: var(--color-text-secondary) !important;
  font-style: normal;
`
