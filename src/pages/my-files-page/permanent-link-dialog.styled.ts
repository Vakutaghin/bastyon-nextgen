import styled from 'vue3-styled-components'

export const SC_LinkBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

export const SC_LinkNote = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ui-text-muted);
`

export const SC_LinkTarget = styled.p`
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-text-highlighted);
  overflow-wrap: anywhere;
`

/** Поле и кнопка в строку; на узком экране кнопка уходит вниз. */
export const SC_LinkBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  & > :first-child {
    flex: 1 1 220px;
    min-width: 0;
  }
`

export const SC_LinkQr = styled.div`
  display: flex;
  justify-content: center;
  min-height: 240px;

  img {
    width: 240px;
    height: 240px;
    border-radius: var(--ui-radius-md);
  }
`

export const SC_LinkSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--ui-border);
`

export const SC_LinkHeading = styled.h3`
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`
