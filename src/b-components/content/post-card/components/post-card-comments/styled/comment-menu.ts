import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

/** Кнопка-триггер контекстного меню комментария (три точки) */
export const SC_MenuTrigger = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: ${COLORS.TEXT_SECONDARY};
  border-radius: 50%;
  cursor: pointer;
  padding: 0;

  &:hover {
    background: ${COLORS.OVERLAY_6};
    color: ${COLORS.TEXT_PRIMARY};
  }

  svg {
    width: 16px;
    height: 16px;
  }
`

/** Контейнер списка пунктов меню в поповере */
export const SC_MenuList = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 180px;
  padding: 4px 0;
`

/** Пункт меню */
export const SC_MenuItem = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border: none;
  background: transparent;
  font-size: 14px;
  color: ${COLORS.TEXT_PRIMARY};
  cursor: pointer;
  text-align: left;

  &:hover:not(:disabled) {
    background: ${COLORS.BG_TERTIARY};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &.menu-item--danger {
    color: ${COLORS.RED_ANT};
  }
  &.menu-item--danger:hover {
    background: rgba(255, 77, 79, 0.08);
  }

  svg {
    width: 14px;
    height: 14px;
  }
`
