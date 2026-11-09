import styled from 'vue3-styled-components'
import { nuxtField } from '@/styles/field-styles'

/** «Сначала лучшее», «Новые посты сразу», «Язык ленты» и «Репутация авторов» — над категориями. */
export const SC_FeedSettings = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
`

export const SC_TopFirstWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`

export const SC_TopFirstLabel = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_FeedLanguageLabel = styled.label`
  font-size: 12px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_FeedLanguageSelect = styled.div`
  flex-shrink: 0;
  width: 132px;

  /* Несколько языков — одной строкой текста («RU, EN, DE»), как значение
     обычного поля, а не плашками: в 132px плашки не помещаются. */
  .ant-select-multiple .ant-select-selection-overflow-item-rest .ant-select-selection-item {
    max-width: 100%;
    margin: 0;
    padding-inline: 0;
    background: none;
    border: 0;
  }

  .ant-select-multiple .ant-select-selection-item-content {
    margin-inline-end: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--ui-text-highlighted);
  }

  .ant-select-multiple .ant-select-selector {
    padding-inline: 11px 30px;
  }
`

/** Своё значение «Репутации авторов» — поле той же высоты, что выбор рядом (32px). */
export const SC_ReputationInput = styled.input`
  ${nuxtField}
  flex-shrink: 0;
  width: 132px;
  padding-block: 5px;
  text-align: right;
  font-variant-numeric: tabular-nums;
`
