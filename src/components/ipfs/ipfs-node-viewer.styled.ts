import styled from 'vue3-styled-components'

export const SC_ViewerBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
`

/** Адрес как в адресной строке: моноширинный, длинный CID переносится. */
export const SC_Address = styled.div`
  font-family: var(--font-family-mono, monospace);
  font-size: 12px;
  color: var(--ui-text-muted);
  word-break: break-all;
`

export const SC_Note = styled.div`
  font-size: 13px;
  line-height: 1.5;
  color: var(--ui-text-muted);
`

export const SC_Status = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 24px 4px;
`

export const SC_StatusText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`

export const SC_StatusHeading = styled.div`
  font-size: 15px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_StatusDetail = styled.div`
  font-size: 13px;
  line-height: 1.5;
  color: var(--ui-text-muted);
`

/** Показ файла: картинка и видео вписываются в окно, не растягиваясь. */
export const SC_Preview = styled.div`
  display: flex;
  justify-content: center;
  min-width: 0;
  max-height: 70vh;
  overflow: hidden;
  border-radius: var(--ui-radius-md);
  background: var(--ui-bg-elevated);

  & img,
  & video {
    display: block;
    max-width: 100%;
    max-height: 70vh;
    object-fit: contain;
  }

  & audio {
    width: 100%;
    margin: 16px;
  }
`

export const SC_Text = styled.pre`
  width: 100%;
  max-height: 60vh;
  margin: 0;
  padding: 12px;
  overflow: auto;
  font-family: var(--font-family-mono, monospace);
  font-size: 12px;
  line-height: 1.5;
  color: var(--ui-text);
  white-space: pre-wrap;
  word-break: break-word;
`

/** Файл без показа: значок, имя и размер. */
export const SC_FileCard = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: var(--ui-radius-md);
  background: var(--ui-bg-elevated);
  font-size: 14px;
  color: var(--ui-text);

  & > .anticon {
    flex-shrink: 0;
    font-size: 28px;
    color: var(--ui-text-muted);
  }
`

export const SC_FileCardText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  word-break: break-all;
`

export const SC_EntryList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 60vh;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
`

export const SC_EntryButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px;
  border: none;
  border-radius: var(--ui-radius-md);
  background: none;
  color: var(--ui-text);
  font-size: 14px;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: rgb(var(--ui-bg-elevated-rgb) / 50%);
  }

  & > .anticon {
    flex-shrink: 0;
    color: var(--ui-text-muted);
  }
`

export const SC_EntryName = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SC_EntrySize = styled.span`
  flex-shrink: 0;
  font-size: 12px;
  color: var(--ui-text-dimmed);
`

/** Кнопки внизу: «Назад» слева, действия справа; на узком экране — в столбик. */
export const SC_Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
`

export const SC_Spacer = styled.div`
  flex: 1;
`
