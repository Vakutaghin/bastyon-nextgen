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

export const SC_CaptchaModalWrapper = styled.div`
  /* Стили для модального окна применяются через wrapClassName */

  :deep(.captcha-modal-wrap) {
    .ant-modal {
      max-width: 450px;
    }

    .ant-modal-body {
      padding: 1.5em;
    }
  }
`
