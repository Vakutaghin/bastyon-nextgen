import styled from 'vue3-styled-components'

/** Поиск, порядок и тема над роликами автора. */
export const SC_VideoTools = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 12px 0 16px;

  .results {
    margin: 0;
  }
`

/** Порядок слева, тема справа; на узком экране тема уходит под кнопки. */
export const SC_ToolsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;

  .tag {
    flex: 0 1 220px;
    min-width: 160px;
  }
`
