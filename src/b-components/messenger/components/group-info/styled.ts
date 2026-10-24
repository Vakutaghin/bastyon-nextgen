import styled from 'vue3-styled-components'

/** Окно не выше экрана: прокручивается список, шапка группы остаётся. */
export const SC_GroupBody = styled.div`
  display: flex;
  flex-direction: column;
  max-height: calc(100dvh - 160px);
  min-height: 0;
`

export const SC_GroupHead = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
`

export const SC_GroupHeadText = styled.div`
  min-width: 0;
`

export const SC_GroupName = styled.div`
  font-size: 18px;
  font-weight: 600;
  line-height: calc(1.3 * var(--leading-scale));
  color: var(--ui-text-highlighted);
  overflow-wrap: anywhere;
`

export const SC_GroupMeta = styled.div`
  margin-top: 2px;
  font-size: 13px;
  color: var(--color-text-secondary);
`

export const SC_GroupTopic = styled.p`
  margin: 12px 0 0;
  font-size: 14px;
  line-height: calc(1.45 * var(--leading-scale));
  color: var(--color-text-primary);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`

export const SC_GroupActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
`

export const SC_ActionBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: background-color var(--transition-fast);

  &:hover {
    background: var(--color-bg-tertiary);
  }

  &.danger {
    color: var(--ui-error);
  }
`

export const SC_MembersHead = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 20px;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_MembersCount = styled.span`
  font-weight: 400;
  color: var(--ui-text-dimmed);
`

export const SC_MemberSearch = styled.input`
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 8px;
  padding: 6px 10px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-md);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: var(--ui-primary);
  }
`

export const SC_MembersEmpty = styled.div`
  padding: 12px 0;
  font-size: 14px;
  color: var(--color-text-secondary);
`

export const SC_MemberList = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  margin: 0 -24px;
  padding: 0 16px 4px;
`

export const SC_MemberRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--ui-radius-md);

  &:hover {
    background: var(--color-bg-tertiary);
  }

  &.invited,
  &.ignored {
    opacity: 0.6;
  }
`

export const SC_MemberMain = styled.div`
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
`

export const SC_MemberText = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
`

export const SC_MemberName = styled.div`
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-text-highlighted);

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

export const SC_YouTag = styled.em`
  flex-shrink: 0;
  font-style: normal;
  font-size: 12px;
  font-weight: 400;
  color: var(--ui-text-dimmed);
`

export const SC_MemberSub = styled.div`
  font-size: 12px;
  color: var(--color-text-secondary);
`

export const SC_MemberActions = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
`

export const SC_IconBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 16px;
  cursor: pointer;

  &:hover {
    background: var(--ui-bg-elevated);
    color: var(--color-text-primary);
  }

  &.active {
    color: var(--ui-error);
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`
