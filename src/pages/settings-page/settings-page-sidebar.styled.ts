import styled, { css } from 'vue3-styled-components'
import { BREAKPOINTS, TRANSITIONS } from '@/styles/design-tokens'

const sidebarItemProps = { active: Boolean }

export const SC_SettingsSidebar = styled.nav`
  flex-shrink: 0;
  width: 220px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 0;

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    width: 100%;
    flex-flow: row wrap;
    gap: 6px;
    padding: 4px 0;
  }
`

/** Пункт навигации в оформлении Nuxt UI, как в сайдбаре ленты. */
export const SC_SettingsSidebarItem = styled('button', sidebarItemProps)`
  display: block;
  width: 100%;
  padding: 6px 10px;
  text-align: left;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  color: var(--ui-text-muted);
  background: transparent;
  border: none;
  border-radius: var(--ui-radius-md);
  cursor: pointer;
  transition:
    background ${TRANSITIONS.QUICK},
    color ${TRANSITIONS.QUICK};

  &:hover {
    background: rgb(var(--ui-bg-elevated-rgb) / 50%);
    color: var(--ui-text-highlighted);
  }

  ${(p: { active?: boolean }) =>
    p.active &&
    css`
      color: var(--ui-primary);
      background: var(--ui-bg-elevated);

      &:hover {
        background: var(--ui-bg-elevated);
        color: var(--ui-primary);
      }
    `}

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    width: auto;
    min-width: 110px;
    padding: 8px 12px;
  }
`
