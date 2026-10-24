import styled from 'vue3-styled-components'

export const SC_BadgeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  margin: 8px 0 4px;

  &.start {
    justify-content: flex-start;
    margin: 4px 0 0;
  }
`

// Отметка — кнопка: нажатие открывает подсказку. Цвет у каждой свой, тот же,
// что у значка на аватаре (--ui-mark-* в style.css): подложка и текст.
export const SC_Badge = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 9px;
  border: 1px solid rgb(var(--ui-mark-verified-rgb) / 30%);
  border-radius: var(--ui-radius-lg);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  background: rgb(var(--ui-mark-verified-rgb) / 12%);
  color: var(--ui-mark-verified-text);
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: rgb(var(--ui-mark-verified-rgb) / 20%);
    color: var(--ui-mark-verified-text);
  }

  &.moderator {
    border-color: rgb(var(--ui-mark-moderator-rgb) / 35%);
    background: rgb(var(--ui-mark-moderator-rgb) / 14%);
    color: var(--ui-mark-moderator-text);

    &:hover,
    &:focus-visible {
      background: rgb(var(--ui-mark-moderator-rgb) / 24%);
      color: var(--ui-mark-moderator-text);
    }
  }

  &.shark {
    border-color: rgb(var(--ui-mark-shark-rgb) / 30%);
    background: rgb(var(--ui-mark-shark-rgb) / 12%);
    color: var(--ui-mark-shark-text);

    &:hover,
    &:focus-visible {
      background: rgb(var(--ui-mark-shark-rgb) / 20%);
      color: var(--ui-mark-shark-text);
    }
  }

  &.established {
    border-color: rgb(var(--ui-mark-established-rgb) / 30%);
    background: rgb(var(--ui-mark-established-rgb) / 12%);
    color: var(--ui-mark-established-text);

    &:hover,
    &:focus-visible {
      background: rgb(var(--ui-mark-established-rgb) / 20%);
      color: var(--ui-mark-established-text);
    }
  }
`

export const SC_HintCard = styled.div`
  max-width: 280px;
  font-size: 13px;
  line-height: calc(1.5 * var(--leading-scale));
  color: var(--ui-text);
`

export const SC_HintTitle = styled.div`
  margin-bottom: 4px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_HintText = styled.p`
  margin: 0 0 8px;
`

export const SC_HintMore = styled.button`
  padding: 0;
  background: none;
  border: none;
  font-size: 13px;
  color: var(--ui-primary-text);
  cursor: pointer;

  &:hover {
    color: var(--ui-primary-text);
    text-decoration: underline;
  }
`
