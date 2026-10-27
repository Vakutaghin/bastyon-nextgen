import styled from 'vue3-styled-components'

export const SC_SheetBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

/** Кнопки колонки рассчитаны на её поле справа: здесь — во всю ширину. */
export const SC_SheetActions = styled.div`
  & > button {
    width: 100%;
    margin: 0;
    min-height: 40px;
  }
`
