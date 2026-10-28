import styled from 'vue3-styled-components'

/** «Сначала лучшее» и «Язык ленты» — порядок и язык ленты, над категориями. */
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
`
