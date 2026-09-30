import styled from 'vue3-styled-components'

export const SC_BoostBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`

/** Какой пост продвигаем — начало текста в кавычках, не больше двух строк. */
export const SC_PostPreview = styled.div`
  display: -webkit-box;
  overflow: hidden;
  font-size: 14px;
  color: var(--ui-text-highlighted);
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow-wrap: anywhere;
`

export const SC_Intro = styled.div`
  font-size: 14px;
  line-height: 20px;
  color: var(--ui-text-muted);
`

export const SC_CurrentBoost = styled.div`
  font-size: 14px;
  color: var(--ui-text);
`

/** Прогноз: вероятность попасть в первые посты ленты языка. */
export const SC_Forecast = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 10px 12px;
  border-radius: var(--ui-radius-md);
  background-color: var(--ui-bg-elevated);
  font-size: 14px;
  line-height: 20px;
  color: var(--ui-text);
`

export const SC_ForecastAction = styled.button`
  padding: 0;
  border: none;
  background: none;
  color: var(--ui-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }

  &:disabled {
    color: var(--ui-text-dimmed);
    cursor: default;
    text-decoration: none;
  }
`
