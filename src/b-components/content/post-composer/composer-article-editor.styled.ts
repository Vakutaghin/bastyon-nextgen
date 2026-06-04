import styled from 'vue3-styled-components'

import { BORDER_RADIUS, FONT_SIZE, SPACING } from '@/styles/design-tokens'
import { COLORS } from '@/styles/theme-colors'

export const SC_ArticleEditor = styled.div`
  min-height: 240px;
  padding: ${SPACING.SM} ${SPACING.MD};
  font-size: ${FONT_SIZE.LG};
  line-height: 1.6;
  color: ${COLORS.TEXT_PRIMARY};
  background: ${COLORS.BG_INPUT};
  border: 1px solid ${COLORS.BORDER};
  border-radius: ${BORDER_RADIUS.MD};

  /* Editor.js рисует своё контент-поле внутри — даём ему цвет темы и убираем лишние отступы. */
  & .codex-editor__redactor {
    padding-bottom: 0 !important;
  }

  & .ce-block__content,
  & .ce-toolbar__content {
    max-width: none;
  }

  & .cdx-block {
    color: ${COLORS.TEXT_PRIMARY};
  }
`
