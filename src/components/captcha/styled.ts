import styled from 'vue3-styled-components'

import { COLORS } from '@/styles/theme-colors'

export const SC_CaptchaWrapper = styled.div`
  padding: 1em;
`

export const SC_Reason = styled.div`
  margin-top: 0.5em;
  margin-bottom: 0.5em;
  padding: 1em;

  span {
    font-size: 1.2em;
    font-weight: 700;
    color: ${COLORS.WARNING_HEX};
  }
`

export const SC_Subcaption = styled.div`
  margin: 0 auto;
  margin-top: 0.5em;
  font-weight: 700;
  padding-left: 1em;
  padding-right: 1em;
`

export const SC_CaptchaImageWrapper = styled.div<{ shown: boolean }>`
  opacity: ${(p) => (p.shown ? 1 : 0)};
  transition: opacity 0.3s;
`

export const SC_CaptchaImage = styled.div`
  /* Стили для контейнера изображения капчи */
`

export const SC_CaptchaSvgImage = styled.div`
  margin: 1.5em 0;
  text-align: center;
`

export const SC_Controls = styled.div<{ shown: boolean }>`
  opacity: ${(p) => (p.shown ? 1 : 0)};
  transition: opacity 0.3s;
`

export const SC_InputWrapper = styled.div`
  margin: 0 auto;
  margin-bottom: 0.5em;
  padding-left: 1em;
  padding-right: 1em;
`

export const SC_CaptchaInput = styled.input`
  font-size: 1.4em;
  border: 0;
  border-bottom: 1px solid ${COLORS.GRAY_CCC};
  transition: border-color 0.3s;
  border-radius: 0;
  width: 100%;
  background: transparent;
  padding: 0.5em 0;

  &:focus {
    outline: none;
    border-bottom-color: ${COLORS.PRIMARY};
  }
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
  border-radius: 4px;
  font-size: 1em;
  cursor: ${(p) => (p.disabled ? 'not-allowed' : 'pointer')};
  transition: all 0.3s;
  background: ${COLORS.PRIMARY};
  color: ${COLORS.WHITE};
  opacity: ${(p) => (p.disabled ? 0.5 : 1)};

  &:hover:not(:disabled) {
    opacity: 0.9;
  }
`

export const SC_RedoButton = styled.button`
  min-width: 180px;
  padding: 0.75em 1.5em;
  border: 1px solid ${COLORS.GRAY_CCC};
  border-radius: 4px;
  font-size: 1em;
  cursor: pointer;
  transition: all 0.3s;
  background: transparent;
  color: ${COLORS.TEXT_PRIMARY};

  &:hover {
    background: ${COLORS.BG_HOVER};
  }
`
