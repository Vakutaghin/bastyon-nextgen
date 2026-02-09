import styled from 'vue3-styled-components'

export const SC_PostContent = styled.div`
  margin-bottom: 15px;
  line-height: 1.6;
  color: rgb(33, 37, 41) !important;
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;

  p {
    margin: 0;
    color: rgb(33, 37, 41) !important;
    word-wrap: break-word;
    overflow-wrap: break-word;
    word-break: break-word;
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

export const SC_PostPreview = styled.div`
  position: relative;
  overflow: hidden;
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;

  p {
    margin: 0 0 7.50px 0;
    color: rgb(33, 37, 41) !important;

    &:last-child {
      margin-bottom: 0;
    }
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
