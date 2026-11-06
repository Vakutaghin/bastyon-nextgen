import styled from 'vue3-styled-components'

/** Окно приглашения занимает место ленты и поля ввода: до вступления их нет. */
export const SC_InviteWrap = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
`

export const SC_InviteCard = styled.div`
  width: 100%;
  max-width: 380px;
  box-sizing: border-box;
  padding: 20px 16px 16px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  background: var(--color-bg-primary);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
`

export const SC_InviteTitle = styled.div`
  font-size: 15px;
  font-weight: 600;
  line-height: calc(1.35 * var(--leading-scale));
  color: var(--ui-text);
  overflow-wrap: anywhere;
`

export const SC_InviteText = styled.div`
  font-size: 13px;
  line-height: calc(1.45 * var(--leading-scale));
  color: var(--ui-text-muted);

  &.error {
    color: var(--ui-error);
  }
`

export const SC_InviteActions = styled.div`
  margin-top: 6px;
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
`
