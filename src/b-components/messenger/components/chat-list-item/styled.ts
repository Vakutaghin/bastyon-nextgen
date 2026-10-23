import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_AvatarSlot = styled.div`
  flex-shrink: 0;
  margin-right: 12px;
`

export const SC_ListItem = styled.div`
  display: flex;
  align-items: center;
  padding: 12px;
  cursor: pointer;
  transition: background-color var(--transition-fast);
  border-bottom: 1px solid var(--color-bg-hover);

  &:hover {
    background-color: var(--color-bg-tertiary);
  }

  &:hover .dots-btn {
    opacity: 1;
  }

  &.active {
    background-color: rgb(var(--ui-primary-rgb) / 8%);
  }

  &.active:hover {
    background-color: rgb(var(--ui-primary-rgb) / 10%);
  }

  &.active .dots-btn {
    opacity: 1;
  }
`

export const SC_Info = styled.div`
  flex: 1;
  overflow: hidden;
`

export const SC_Name = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  font-weight: 500;
  font-size: 14px;
  color: var(--ui-text-highlighted);
  margin-bottom: 4px;
`

export const SC_NameText = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

/** Значок группы перед названием. */
export const SC_GroupMark = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  font-size: 14px;
  color: var(--ui-primary);
`

/** Уведомления выключены — серый колокольчик после названия. */
export const SC_MutedMark = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  font-size: 12px;
  color: var(--ui-text-dimmed);
`

export const SC_SenderPrefix = styled.span`
  color: var(--color-text-primary);
`

/** Значок mesh-сети у имени: переписка идёт через радио, а не через интернет. */
export const SC_NetworkMark = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  font-size: 12px;
  vertical-align: -1px;
  color: var(--ui-primary);
`

export const SC_LastMessage = styled.div`
  font-size: 14px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const SC_Meta = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-left: 8px;
  flex-shrink: 0;
`

export const SC_Time = styled.span`
  font-size: 12px;
  color: var(--ui-text-dimmed);
  margin-bottom: 4px;
`

export const SC_Badge = styled.span`
  background-color: var(--ui-primary);
  color: var(--ui-text-inverted);
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: var(--ui-radius-lg);
  min-width: 18px;
  text-align: center;

  /* Без звука счётчик есть, но не зовёт. */
  &.muted {
    background-color: var(--ui-text-dimmed);
  }
`

/** Без звука сервер непрочитанные не считает — есть новое, но без числа. */
export const SC_UnreadDot = styled.span`
  width: 10px;
  height: 10px;
  margin: 0 4px;
  border-radius: 50%;
  background-color: var(--ui-text-dimmed);
`

export const SC_MenuWrap = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-height: 22px;
`

export const SC_DotsBtn = styled.button`
  opacity: 0;

  /* Без мыши наводить нечем: на планшете и телефоне «…» видно всегда, иначе
     удалить чат было нечем — кнопка была, но невидимая. */
  @media (hover: none) {
    opacity: 1;
  }
  background: none;
  border: none;
  cursor: pointer;
  color: var(--ui-text-dimmed);
  padding: 2px 4px;
  border-radius: var(--ui-radius-sm);
  transition:
    opacity var(--transition-fast),
    color var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;

  &:hover {
    color: var(--color-text-primary);
  }
`

export const SC_Dropdown = styled.div`
  background: var(--color-bg-primary);
  border-radius: var(--ui-radius-lg);
  box-shadow: var(--shadow-md);
  min-width: 180px;
  padding: 4px 0;
`

export const SC_DropdownItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 14px;
  color: var(--color-text-primary);
  cursor: pointer;
  transition: background-color var(--transition-quick);
  white-space: nowrap;

  &:hover {
    background-color: var(--color-bg-tertiary);
  }

  &.danger .anticon {
    color: var(--color-red-ant);
  }
`

export const SC_Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 10000;
`

export const SC_ConfirmOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: var(--color-overlay-40);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10002;
`

export const SC_ConfirmDialog = styled.div`
  background: var(--color-bg-primary);
  border-radius: var(--ui-radius-lg);
  padding: 24px;
  width: 95%;
  max-width: 480px;
  box-sizing: border-box;
  box-shadow: ${COLORS.SHADOW_LG};
`

export const SC_ConfirmTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  margin-bottom: 8px;
`

export const SC_ConfirmText = styled.div`
  font-size: 14px;
  color: var(--color-text-secondary);
  margin-bottom: 20px;
  line-height: 1.4;
  overflow-wrap: anywhere;
  word-break: break-word;
`

export const SC_ConfirmButtons = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`

export const SC_CancelBtn = styled.button`
  padding: 8px 16px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: background-color var(--transition-fast);

  &:hover {
    background-color: var(--color-bg-tertiary);
  }
`

export const SC_ConfirmDeleteBtn = styled.button`
  padding: 8px 16px;
  border: none;
  border-radius: var(--ui-radius-lg);
  background: var(--color-red-ant);
  color: var(--color-white);
  font-size: 14px;
  cursor: pointer;
  transition: background-color var(--transition-fast);

  &:hover {
    background-color: var(--color-red-dark);
  }
`
