import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_EventsWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 6px;
  border-radius: var(--ui-radius-md);
  transition: background-color 0.2s;
  color: var(--color-text-primary);

  &:hover {
    background-color: var(--ui-bg-elevated);
  }
`

export const SC_PendingEventsMenu = styled.div`
  background: var(--ui-bg);
  border-radius: var(--ui-radius-md);
  box-shadow:
    0 0 0 1px var(--ui-border),
    var(--ui-shadow-lg);
  padding: 8px;
  min-width: 300px;
  max-width: 380px;
  max-height: 80vh;
  overflow-y: auto;
`

/** Заголовок выпадашки — общий контекст «эти события ещё не в блокчейне». */
export const SC_MenuHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px 10px;
  color: var(--color-text-secondary);
`

export const SC_MenuTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
`

export const SC_EmptyMessage = styled.div`
  padding: 12px;
  text-align: center;
  color: var(--color-gray-999);
`

export const SC_EventsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

export const SC_EventItem = styled.div`
  border: 1px solid var(--color-gray-e8);
  border-radius: var(--ui-radius-lg);
  padding: 10px 12px;
  background: var(--color-bg-primary);
  display: flex;
  flex-direction: column;
  gap: 8px;
`

/** Верхняя строка карточки: чип-тип слева, статус «в блокчейне ещё нет» справа. */
export const SC_EventTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`

/** Пилюля-метка типа события (иконка + подпись). */
export const SC_KindChip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--color-ant-blue-bg);
  color: var(--color-ant-blue);
  font-size: 12px;
  font-weight: 600;
`

export const SC_PendingTag = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--color-gray-999);
  white-space: nowrap;
`

/** Панель с содержимым события (визуально отделяет текст от метаданных). */
export const SC_EventPanel = styled.div`
  background: var(--color-bg-input);
  border: 1px solid var(--color-gray-e8);
  border-radius: var(--ui-radius-lg);
  padding: 8px 10px;
`

export const SC_EventContent = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
`

/** Заголовок поста — одна строка с многоточием. */
export const SC_PostTitle = styled.div`
  font-size: 15px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
`

/** Текст поста/коммента — аккуратные ДВЕ строки с многоточием. */
export const SC_Snippet = styled.div`
  font-size: 13px;
  line-height: 1.4;
  color: var(--color-gray-555);
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`

/** Отступ сниппета от заголовка внутри панели. */
export const SC_SnippetSpaced = styled(SC_Snippet)`
  margin-top: 4px;
`

export const SC_RatingDisplay = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--color-bg-primary);
  padding: 2px 8px;
  border-radius: var(--ui-radius-lg);
  border: 1px solid var(--color-bg-hover);
  white-space: nowrap;
`

export const SC_RatingValue = styled.span`
  font-size: 15px;
  font-weight: 700;
  color: var(--ui-text-highlighted);
`

/** Строка действий карточки (кнопка «Перейти к посту»). */
export const SC_ItemActions = styled.div`
  display: flex;
  justify-content: flex-end;
`

// ── Модалка-превью pending-поста ──────────────────────────────────────

/** Баннер-пометка: пост ещё не в блокчейне (confirmed → «опубликован»). */
export const SC_PreviewNote = styled('div', { confirmed: Boolean })`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  margin-bottom: 12px;
  border-radius: var(--ui-radius-lg);
  background: ${(p) => (p.confirmed ? COLORS.SUCCESS_BG_TINT : COLORS.ANT_BLUE_BG)};
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.4;

  .anticon {
    color: ${(p) => (p.confirmed ? COLORS.SUCCESS : COLORS.ANT_BLUE)};
    font-size: 16px;
    flex-shrink: 0;
    margin-top: 1px;
  }
`

export const SC_PreviewBody = styled.div`
  border: 1px solid var(--color-gray-e8);
  border-radius: var(--ui-radius-lg);
  overflow: hidden;
`
