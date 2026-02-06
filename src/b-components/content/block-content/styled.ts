import styled from 'vue3-styled-components'

export const SC_BlockContent = styled.div`
  width: 100%;
  color: rgb(33, 37, 41) !important;

  > * {
    margin-bottom: 1em;
    color: rgb(33, 37, 41) !important;
  }

  > *:last-child {
    margin-bottom: 0;
  }

  :deep(*) {
    color: rgb(33, 37, 41) !important;
  }

  :deep(p) {
    color: rgb(33, 37, 41) !important;
  }

  :deep(div) {
    color: rgb(33, 37, 41) !important;
  }

  :deep(span) {
    color: rgb(33, 37, 41) !important;
  }

  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4),
  :deep(h5),
  :deep(h6) {
    color: rgb(33, 37, 41) !important;
  }
`
