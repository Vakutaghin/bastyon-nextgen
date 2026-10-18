import styled from 'vue3-styled-components'

// ── Окно оформления ────────────────────────────────────────────────────

export const SC_PaidBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  font-size: 14px;
  line-height: 1.45;
  color: var(--ui-text);
`

export const SC_PaidAuthor = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
`

export const SC_PaidAuthorText = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`

export const SC_PaidAuthorName = styled.span`
  font-weight: 600;
  color: var(--ui-text-highlighted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SC_PaidAuthorPrice = styled.span`
  font-size: 13px;
  color: var(--ui-text-muted);
`

/** Плашка статуса: «Оплачено до …» зелёная, «закончилась …» — приглушённая. */
export const SC_PaidStatus = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: var(--ui-radius-md);
  background: var(--ui-bg-elevated);
  color: var(--ui-text-muted);
  font-size: 13px;

  &.active {
    background: rgb(var(--ui-success-rgb) / 12%);
    color: var(--ui-success-deep);
  }
`

export const SC_PaidText = styled.p`
  margin: 0;
`

export const SC_PaidNote = styled.p`
  margin: 0;
  font-size: 12px;
  color: var(--ui-text-muted);
`

export const SC_PlanList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

/** Срок — карточка-переключатель: название и «до …» слева, сумма справа. */
export const SC_PlanOption = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--ui-border-accented);
  border-radius: var(--ui-radius-md);
  background: var(--ui-bg);
  color: var(--ui-text);
  text-align: left;
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background-color var(--transition-fast);

  &:hover:not(:disabled) {
    background: var(--ui-bg-elevated);
  }

  &.selected,
  &.selected:hover {
    border-color: var(--ui-primary);
    background: rgb(var(--ui-primary-rgb) / 8%);
  }

  &:focus-visible {
    outline: 2px solid var(--ui-primary);
    outline-offset: 2px;
  }

  &:disabled {
    cursor: default;
    opacity: 0.6;
  }
`

export const SC_PlanRadio = styled.span`
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
  border: 1px solid var(--ui-border-accented);
  border-radius: 50%;
  background: var(--ui-bg);

  .selected & {
    border: 5px solid var(--ui-primary);
  }
`

export const SC_PlanText = styled.span`
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
`

export const SC_PlanName = styled.span`
  font-weight: 500;
  color: var(--ui-text-highlighted);
`

export const SC_PlanSaving = styled.span`
  margin-left: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--ui-primary);
`

export const SC_PlanUntil = styled.span`
  font-size: 12px;
  color: var(--ui-text-muted);
`

export const SC_PlanAmount = styled.span`
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  white-space: nowrap;
`

export const SC_PlanAmountNote = styled.span`
  font-size: 11px;
  font-weight: 400;
  color: var(--ui-text-muted);
`

export const SC_PaidError = styled.div`
  font-size: 13px;
  color: var(--color-red-ant);
`

export const SC_PaidCenter = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 16px 0;
  color: var(--ui-text-muted);
  text-align: center;
`

// ── Плашка на посте ────────────────────────────────────────────────────

/** Высота как у текста поста в одну-две строки: открытие поста не дёргает ленту. */
export const SC_PaidNotice = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 12px;
  margin: 8px 0;
  padding: 14px 16px;
  min-height: 56px;
  border: 1px dashed var(--ui-border-accented);
  border-radius: var(--ui-radius-md);
  background: var(--ui-bg-elevated);
  color: var(--ui-text-muted);
  font-size: 14px;
  line-height: 1.4;
`

export const SC_PaidNoticeText = styled.span`
  flex: 1 1 220px;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;

  .anticon {
    flex: 0 0 auto;
    color: var(--ui-primary);
  }
`

export const SC_PaidNoticeAction = styled.button`
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 0;
  border-radius: var(--ui-radius-md);
  background: var(--ui-primary);
  color: var(--ui-text-inverted);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity var(--transition-fast);

  &:hover:not(:disabled) {
    opacity: 0.88;
  }

  &.secondary {
    background: transparent;
    border: 1px solid var(--ui-border-accented);
    color: var(--ui-text);
  }

  &:disabled {
    cursor: default;
    opacity: 0.6;
  }
`

// ── Кнопка в профиле ───────────────────────────────────────────────────

/** Подпись кнопки в две строки: что делает — и сумма или срок под ней. */
export const SC_PaidButtonLabel = styled.span`
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  line-height: 1.25;
`

export const SC_PaidButtonSub = styled.span`
  font-size: 12px;
  font-weight: 400;
  opacity: 0.85;
`

export const SC_PaidProfileButton = styled.button`
  width: 100%;
  margin: 0 20px 16px 0;
  padding: 10px 14px;
  border-radius: var(--ui-radius-lg);
  border: 1px solid rgb(var(--ui-primary-rgb) / 35%);
  background-color: rgb(var(--ui-primary-rgb) / 8%);
  color: var(--ui-primary);
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: background-color var(--transition-fast);

  &:hover {
    background-color: rgb(var(--ui-primary-rgb) / 14%);
  }

  &.active {
    border-color: rgb(var(--ui-success-rgb) / 40%);
    background-color: rgb(var(--ui-success-rgb) / 10%);
    color: var(--ui-success-deep);
  }
`

export const SC_PaidConfirm = styled.div`
  padding: 10px 12px;
  border: 1px solid var(--ui-border-accented);
  border-radius: var(--ui-radius-md);
  background-color: var(--ui-bg-elevated);
  font-size: 13px;
  line-height: 1.4;
`
