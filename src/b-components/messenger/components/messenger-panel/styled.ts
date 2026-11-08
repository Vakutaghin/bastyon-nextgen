import styled from 'vue3-styled-components'
import { BREAKPOINTS, SHELL } from '@/styles/design-tokens'
import { noSelect } from '@/styles/chrome-styles'

export const SC_MessengerContainer = styled.div`
  flex: 1;
  display: flex;
  background: var(--color-bg-primary);
  border-radius: var(--ui-radius-lg);
  /* Внешняя рамка заметнее разделителей внутри: фон мессенджера — как у
     страницы, и с --ui-border в тёмной теме он с ней сливался. */
  border: 1px solid var(--ui-border-accented);
  overflow: hidden;

  /* Remove margin here, let parent control it */

  /* margin: 20px 0; */
  height: 100%;

  /* Телефон: мессенджер и так во весь экран — рамка лишь отнимала по пикселю. */
  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    border: 0;
    border-radius: 0;
  }
`

const sidebarProps = {
  isHidden: Boolean,
}

export const SC_SidebarColumn = styled('div', sidebarProps)`
  ${noSelect}
  width: 320px;
  border-right: 1px solid var(--ui-border);
  display: flex;
  flex-direction: column;
  background: var(--color-bg-primary);

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    width: 100%;
    display: ${(props) => (props.isHidden ? 'none' : 'flex')};
  }

  /* Телефон боком — как телефон: открытый чат на всю ширину, список за
     стрелкой «назад». Рядом со списком переписке оставалось 400 px, а по
     высоте и так 360. */
  ${() => SHELL.RAIL} & {
    width: 100%;
    display: ${(props) => (props.isHidden ? 'none' : 'flex')};
  }
`

const chatProps = {
  isActive: Boolean,
}

export const SC_ChatColumn = styled('div', chatProps)`
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-primary);
  position: relative;

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    display: ${(props) => (props.isActive ? 'flex' : 'none')};
    width: 100%;
  }

  ${() => SHELL.RAIL} & {
    display: ${(props) => (props.isActive ? 'flex' : 'none')};
    width: 100%;
  }
`

/** Шапка сайдбара со списком чатов. */
export const SC_SidebarHeader = styled.div`
  padding: 16px;
  border-bottom: 1px solid var(--ui-border);
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;

  /* Список во всю ширину: справа над шапкой крестик полноэкранного мессенджера,
     лупа — левее него. */
  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    padding-right: calc(var(--safe-right) + 64px);
  }

  /* Телефон боком: список тоже во всю ширину, а высоты мало. */
  ${() => SHELL.RAIL} & {
    padding: 10px calc(var(--safe-right) + 64px) 10px 16px;
  }
`

/** «Сообщения» и значок «догружается» рядом. */
/** Заголовок забирает свободное место — кнопки шапки стоят справа, а не посередине. */
export const SC_SidebarTitle = styled.div`
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
`

/** Верхняя панель в активном чате (back-button + имя собеседника). */
export const SC_ChatTopBar = styled.div`
  ${noSelect}
  height: 56px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--ui-border);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;

  /* Телефон боком: каждый пиксель высоты — переписке. */
  ${() => SHELL.RAIL} & {
    height: 48px;
  }
`

export const SC_EmptyState = styled.div`
  ${noSelect}
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ui-text-dimmed);
  font-size: 16px;
  flex-direction: column;
  gap: 16px;

  svg {
    width: 64px;
    height: 64px;
    color: var(--ui-text-dimmed);
    stroke-width: 1.5;
  }
`

export const SC_MobileBackButton = styled.button`
  margin-right: 12px;
  background: none;
  border: none;
  color: var(--ui-text);
  font-size: 24px;
  cursor: pointer;
  display: none;
  transition: color var(--transition-quick);

  &:hover {
    color: var(--ui-text-highlighted);
  }

  align-items: center;
  justify-content: center;
  padding: 0;

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    display: flex;
  }

  ${() => SHELL.RAIL} & {
    display: flex;
  }
`

export const SC_MessengerDialogsLoader = styled.div`
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--ui-text-dimmed);
  font-size: 14px;
`

export const SC_MessengerDialogsSpinner = styled.span`
  display: inline-block;
  width: 32px;
  height: 32px;
  border: 3px solid var(--ui-border);
  border-top-color: var(--color-text-secondary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite; /* @keyframes spin — глобально в style.css */
`

export const SC_MessengerDialogsLoaderText = styled.span`
  margin: 0;
`
