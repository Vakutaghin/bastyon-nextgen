import styled from 'vue3-styled-components'

// Остальное у строки канала — как у строки чата (../chat-list-item/styled.ts);
// здесь то, чем канал отличается: фиолетовый мегафон и счётчик новых постов.

/** Мегафон перед именем автора. */
export const SC_ChannelMark = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  font-size: 14px;
  color: var(--ui-violet);
`

/** «Фото», «Видео», «Статья» перед текстом поста. */
export const SC_KindLabel = styled.span`
  color: var(--ui-violet);
`

/** Новые посты: спокойнее счётчика сообщений — это чтение, а не переписка. */
export const SC_NewBadge = styled.span`
  padding: 2px 6px;
  min-width: 18px;
  border-radius: var(--ui-radius-lg);
  background-color: rgb(var(--ui-violet-rgb) / 16%);
  color: var(--ui-violet);
  font-size: 11px;
  font-weight: 600;
  text-align: center;
`

/** Меню «…» у строки — у кнопки, поверх списка (координаты кнопки на экране). */
export const SC_MenuAnchor = styled('div', { top: Number, right: Number })`
  position: fixed;
  top: ${(p) => `${p.top ?? 0}px`};
  right: ${(p) => `${p.right ?? 0}px`};
  z-index: 10001;
`
