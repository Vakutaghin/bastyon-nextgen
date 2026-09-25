import styled from 'vue3-styled-components'
import { nuxtField } from '@/styles/field-styles'

export const SC_CaptchaWrapper = styled.div`
  padding: 1em;
`

export const SC_Reason = styled.div`
  margin-top: 0.5em;
  margin-bottom: 0.5em;
  padding: 1em;

  span {
    font-size: 1.2em;
    font-weight: 600;
    color: var(--color-warning-hex);
  }
`

export const SC_Subcaption = styled.div`
  margin: 0 auto;
  margin-top: 0.5em;
  font-weight: 600;
  padding-left: 1em;
  padding-right: 1em;
`

export const SC_CaptchaImageWrapper = styled.div<{ shown: boolean }>`
  opacity: ${(p) => (p.shown ? 1 : 0)};
  transition: opacity var(--transition-normal);
`

export const SC_CaptchaImage = styled.div`
  /* Стили для контейнера изображения капчи */
`

export const SC_CaptchaSvgImage = styled.div`
  margin: 1.5em 0;
  text-align: center;

  img {
    max-width: 100%;
    height: auto;
  }
`

export const SC_Controls = styled.div<{ shown: boolean }>`
  opacity: ${(p) => (p.shown ? 1 : 0)};
  transition: opacity var(--transition-normal);
`

export const SC_InputWrapper = styled.div`
  margin: 0 auto;
  margin-bottom: 0.5em;
  padding-left: 1em;
  padding-right: 1em;
`

export const SC_CaptchaInput = styled.input`
  ${nuxtField}
  /* Код с картинки — крупнее обычного поля. */
  padding: 9px 12px;
  font-size: 16px;
  letter-spacing: 0.05em;
`

export const SC_ButtonsContainer = styled.div`
  margin-top: 2em;
  padding-left: 1em;
  padding-right: 1em;
  display: flex;
  gap: 1em;
  justify-content: center;
`

export const SC_SubmitButton = styled.button<{ disabled: boolean }>`
  min-width: 180px;
  padding: 0.75em 1.5em;
  border: none;
  border-radius: var(--ui-radius-sm);
  font-size: 1em;
  cursor: ${(p) => (p.disabled ? 'not-allowed' : 'pointer')};
  transition: all var(--transition-normal);
  background: var(--color-primary);
  color: var(--ui-text-inverted);
  opacity: ${(p) => (p.disabled ? 0.5 : 1)};

  &:hover:not(:disabled) {
    opacity: 0.9;
  }
`

export const SC_RedoButton = styled.button`
  min-width: 180px;
  padding: 0.75em 1.5em;
  border: 1px solid var(--ui-border-accented);
  border-radius: var(--ui-radius-sm);
  font-size: 1em;
  cursor: pointer;
  transition: all var(--transition-normal);
  background: transparent;
  color: var(--color-text-primary);

  &:hover {
    background: var(--color-bg-hover);
  }
`
