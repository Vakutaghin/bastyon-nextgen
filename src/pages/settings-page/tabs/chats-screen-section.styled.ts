import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'
import { nuxtField } from '@/styles/field-styles'
import { SC_ScaleRow, SC_SystemRow } from './system-tab.styled'

/** Строка правила: подпись сжимается первой, на узком экране выбор уходит под неё. */
export const SC_ScreenRow = styled(SC_SystemRow)`
  flex-wrap: wrap;

  & > :first-child {
    flex: 1 1 240px;
  }
`

/** Порог репутации и выключатель рядом. */
export const SC_ScreenControls = styled.div`
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 12px;
`

export const SC_ScreenNumber = styled.input`
  ${nuxtField}
  width: 84px;
  text-align: right;
  font-variant-numeric: tabular-nums;

  &:disabled {
    opacity: 0.5;
  }
`

/** Люди: поле «ник или адрес», ошибка и список — отступ до следующего раздела общий. */
export const SC_ScreenPeople = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 28px;

  & > * {
    margin: 0;
  }
`

/** Ник или адрес — и кнопка «Скрыть». */
export const SC_ScreenAdd = styled.form`
  display: flex;
  gap: 8px;
`

/** «Скрыт / Виден» у человека; на телефоне — второй строкой под ником. */
export const SC_ScreenPersonRule = styled(SC_ScaleRow)`
  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    order: 1;
    flex: 1 1 calc(100% - 48px);
    margin-left: 48px;
  }
`

export const SC_ScreenInput = styled.input`
  ${nuxtField}
  flex: 1;
  min-width: 0;
`

export const SC_ScreenAddButton = styled.button`
  flex-shrink: 0;
  padding: 0 16px;
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-text-inverted);
  background: var(--ui-primary);
  border: 0;
  border-radius: var(--ui-radius-md);
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }

  &:focus-visible {
    outline: 2px solid var(--ui-focus-outline);
    outline-offset: 1px;
  }
`

export const SC_ScreenError = styled.p`
  font-size: 13px;
  color: var(--ui-error);
`
