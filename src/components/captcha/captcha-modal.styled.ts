import styled from 'vue3-styled-components'

export const SC_ErrorMessage = styled.div`
  margin-top: 1em;
  padding: 0.75em;
  background: var(--color-red-bg);
  border: 1px solid var(--color-red-border);
  border-radius: var(--ui-radius-sm);
  color: var(--color-danger-hover);
  font-size: 0.9em;
`

// Размеры/паддинг captcha-модалки заданы глобально в src/style.css
// (.captcha-modal-wrap) — модалка телепортится в <body>, :deep сюда не доходил.
export const SC_CaptchaModalWrapper = styled.div`
  display: contents;
`
