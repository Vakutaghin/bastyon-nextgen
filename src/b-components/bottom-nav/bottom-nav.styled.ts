import styled from 'vue3-styled-components'
import { TRANSITIONS } from '@/styles/design-tokens'

const activeProps = { active: Boolean }

export const SC_BottomNav = styled.nav`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  /* Слой шапки (1000), а не STICKY (1020): модалки antd стоят на 1000 и
     добавляются в конец body, поэтому их затемнение накрывает панель. С 1020
     панель лежала поверх окна поста и закрывала его низ. */
  z-index: 1000;
  display: flex;
  align-items: stretch;
  /* Высота включает safe-area: при box-sizing: border-box отступ съедал её из
     тех же 56px, на контент оставалось меньше, и иконки с подписями вылезали
     поверх ленты. --bottom-nav-height-total = 56px + safe-area. */
  height: var(--bottom-nav-height-total);
  padding-bottom: var(--safe-bottom);
  /* Как шапка: фон страницы на 75% с размытием, линия сверху. */
  background: rgb(var(--ui-bg-rgb) / 75%);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-top: 1px solid var(--ui-border);
`

export const SC_NavItem = styled('button', activeProps)`
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  position: relative;
  border: none;
  background: none;
  cursor: pointer;
  padding: 4px 0;
  color: ${(p) => (p.active ? 'var(--ui-primary)' : 'var(--ui-text-muted)')};
  transition: color ${TRANSITIONS.FAST};

  &:active {
    opacity: 0.7;
  }
`

export const SC_NavIcon = styled.span`
  font-size: 20px;
  line-height: 1;
  display: inline-flex;
`

export const SC_NavLabel = styled.span`
  font-size: 10px;
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
`

export const SC_NavBadge = styled.span`
  position: absolute;
  top: 2px;
  left: calc(50% + 6px);
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: var(--ui-radius-lg);
  background: var(--ui-error);
  color: var(--ui-text-inverted);
  box-shadow: 0 0 0 2px var(--ui-bg);
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  text-align: center;
`
