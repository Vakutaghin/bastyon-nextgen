import styled from 'vue3-styled-components'
import { nuxtField } from '@/styles/field-styles'

/** Окно «Отправить в чат»: что отправляем, поиск, чаты, подпись, «Отправить». */
export const SC_ShareBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

/** Что отправляем — одной строкой, ссылка целиком в подсказке. */
export const SC_SharePreview = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 8px 12px;
  border-radius: var(--ui-radius-md);
  background: var(--ui-bg-elevated);
  color: var(--ui-text-muted);
  font-size: 13px;

  span {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  svg {
    flex: 0 0 auto;
  }
`

export const SC_ShareSearch = styled.input`
  ${nuxtField}
`

/** Чаты: прокручиваются сами, окно остаётся одной высоты. */
export const SC_ShareList = styled.div`
  display: flex;
  flex-direction: column;
  max-height: min(360px, 45vh);
  margin: 0 -8px;
  overflow-y: auto;
  overscroll-behavior: contain;
`

export const SC_ShareRow = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: var(--ui-radius-md);
  background: none;
  color: var(--ui-text-highlighted);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--transition-fast);

  &:hover:not(:disabled) {
    background: var(--color-overlay-6);
  }

  &.on {
    background: rgb(var(--ui-primary-rgb) / 10%);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  &:focus-visible {
    outline: 2px solid var(--ui-primary);
    outline-offset: -2px;
  }
`

export const SC_ShareName = styled.span`
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 15px;
`

/** Почему чат недоступен — под названием. */
export const SC_ShareNote = styled.span`
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--ui-text-muted);
  font-size: 12px;
`

/** Отметка справа — как кружок выделения сообщений. */
export const SC_ShareCheck = styled.span`
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 2px solid var(--ui-border-accented);
  border-radius: 50%;
  color: var(--ui-bg);
  font-size: 13px;

  &.on {
    border-color: var(--ui-primary);
    background: var(--ui-primary);
  }
`

export const SC_ShareEmpty = styled.p`
  margin: 0;
  padding: 24px 8px;
  text-align: center;
  color: var(--ui-text-muted);
`

export const SC_ShareComment = styled.textarea`
  ${nuxtField}
  resize: none;
`

export const SC_ShareFooter = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
`

/** «Копировать ссылку» и «Поделиться через…» — слева, тише главной кнопки. */
export const SC_ShareExtra = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-left: -8px;
`

export const SC_ShareHint = styled.span`
  color: var(--ui-text-muted);
  font-size: 12px;
`
