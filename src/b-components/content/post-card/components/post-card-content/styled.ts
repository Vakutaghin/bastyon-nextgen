import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_PostContent = styled.div`
  margin-bottom: 15px;
  line-height: 1.2;
  color: ${COLORS.TEXT_PRIMARY} !important;
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;

  p {
    margin: 6px 0;
    color: ${COLORS.TEXT_PRIMARY} !important;
    word-wrap: break-word;
    overflow-wrap: break-word;
    word-break: break-word;
  }

  :deep(*) {
    color: ${COLORS.TEXT_PRIMARY} !important;
  }

  :deep(p) {
    margin: 6px 0;
    color: ${COLORS.TEXT_PRIMARY} !important;
  }

  :deep(div) {
    color: ${COLORS.TEXT_PRIMARY} !important;
  }

  :deep(span) {
    color: ${COLORS.TEXT_PRIMARY} !important;
  }

  :deep(.bastyon-link) {
    color: ${COLORS.PRIMARY} !important;
    text-decoration: underline;
    cursor: pointer;
    word-break: break-all;
    overflow-wrap: break-word;
    word-wrap: break-word;
  }

  :deep(.bastyon-link:hover) {
    color: ${COLORS.PRIMARY_ACTIVE} !important;
    text-decoration: underline;
  }

  :deep(.timecode-link) {
    color: ${COLORS.PRIMARY} !important;
    text-decoration: none;
    cursor: pointer;
    font-variant-numeric: tabular-nums;
    border-bottom: 1px dashed currentColor;
  }

  :deep(.timecode-link:hover) {
    color: ${COLORS.PRIMARY_ACTIVE} !important;
    border-bottom-style: solid;
  }
`

export const SC_PostPreview = styled.div`
  position: relative;
  overflow: hidden;
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;

  p {
    margin: 0 0 7.5px;
    color: ${COLORS.TEXT_PRIMARY} !important;

    &:last-child {
      margin-bottom: 0;
    }
  }

  :deep(.bastyon-link) {
    color: ${COLORS.PRIMARY} !important;
    text-decoration: underline;
    cursor: pointer;
    word-break: break-all;
    overflow-wrap: break-word;
    word-wrap: break-word;
  }

  :deep(.bastyon-link:hover) {
    color: ${COLORS.PRIMARY_ACTIVE} !important;
    text-decoration: underline;
  }
`
