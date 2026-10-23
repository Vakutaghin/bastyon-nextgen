import styled from 'vue3-styled-components'

/** Занимает всю середину шапки, чтобы длинное имя обрезалось, а не выталкивало кнопки. */
export const SC_PartnerTitle = styled.div`
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
`

export const SC_PartnerTitleName = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--ui-text-highlighted);
`

/** Шапка группы — кнопка той же формы, что ссылка-«чип» на профиль собеседника. */
export const SC_GroupTitleBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
  padding: 2px 10px 2px 4px;
  margin-left: -4px;
  border: none;
  border-radius: var(--ui-radius-md);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background var(--transition-fast);

  &:hover {
    background: var(--ui-bg-elevated);
  }

  &:focus-visible {
    outline: 2px solid var(--ui-primary);
    outline-offset: 2px;
  }
`

export const SC_GroupTitleText = styled.span`
  display: flex;
  flex-direction: column;
  min-width: 0;
`

export const SC_GroupTitleSub = styled.span`
  font-size: 12px;
  line-height: 1.2;
  color: var(--color-text-secondary);
  white-space: nowrap;
`

/** «Канал» под именем автора — фиолетовым, как мегафон в списке. */
export const SC_ChannelTitleSub = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  line-height: 1.2;
  color: var(--ui-violet);
  white-space: nowrap;
`
