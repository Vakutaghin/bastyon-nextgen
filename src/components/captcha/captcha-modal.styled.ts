import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_ErrorMessage = styled.div`
  margin-top: 1em;
  padding: 0.75em;
  background: ${COLORS.RED_BG};
  border: 1px solid ${COLORS.RED_BORDER};
  border-radius: 4px;
  color: ${COLORS.DANGER_HOVER};
  font-size: 0.9em;
`

// Размеры/паддинг captcha-модалки заданы глобально в src/style.css
// (.captcha-modal-wrap) — модалка телепортится в <body>, :deep сюда не доходил.
export const SC_CaptchaModalWrapper = styled.div`
  display: contents;
`
