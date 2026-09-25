import styled from 'vue3-styled-components'
import { nuxtField } from '@/styles/field-styles'

// Окно как модалка Nuxt: дымка elevated/75, карточка с кольцом и тенью lg.
// Раньше заголовок был цвета тёмного фона — в тёмной теме его не было видно.
export const SC_Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgb(var(--ui-bg-elevated-rgb) / 75%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 16px;
`

export const SC_Modal = styled.div`
  background: var(--ui-bg);
  border-radius: var(--ui-radius-lg);
  width: 100%;
  max-width: 420px;
  box-shadow:
    0 0 0 1px var(--ui-border),
    var(--ui-shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
`

export const SC_Header = styled.div`
  padding: 16px 20px;
  border-bottom: 1px solid var(--ui-border);
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_Body = styled.div`
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`

export const SC_Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

export const SC_Label = styled.label`
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-text);
`

export const SC_Input = styled.input`
  ${nuxtField}
`

export const SC_Textarea = styled.textarea`
  ${nuxtField}
  resize: vertical;
  min-height: 60px;
`

export const SC_Recipient = styled.div`
  font-size: 13px;
  color: var(--ui-text-toned);
  word-break: break-all;
  background: var(--ui-bg-elevated);
  padding: 8px 10px;
  border-radius: var(--ui-radius-md);
  font-family: var(--font-family-mono);
`

export const SC_Error = styled.div`
  color: var(--color-red-dark);
  font-size: 12px;
`

export const SC_Footer = styled.div`
  padding: 12px 20px;
  border-top: 1px solid var(--ui-border);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`

export const SC_Button = styled('button', { primary: Boolean })`
  /* Кнопки Nuxt: основная — solid-акцент, вторая — нейтральная outline. */
  border: 0;
  padding: 6px 12px;
  border-radius: var(--ui-radius-md);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  cursor: pointer;
  box-shadow: ${(p) => (p.primary ? 'none' : 'inset 0 0 0 1px var(--ui-border-accented)')};
  background: ${(p) => (p.primary ? 'var(--ui-primary)' : 'var(--ui-bg)')};
  color: ${(p) => (p.primary ? 'var(--ui-text-inverted)' : 'var(--ui-text)')};

  &:hover:not(:disabled) {
    background: ${(p) =>
      p.primary ? 'rgb(var(--ui-primary-rgb) / 75%)' : 'var(--ui-bg-elevated)'};
    color: ${(p) => (p.primary ? 'var(--ui-text-inverted)' : 'var(--ui-text)')};
  }

  &:disabled {
    opacity: 0.75;
    cursor: not-allowed;
  }
`
