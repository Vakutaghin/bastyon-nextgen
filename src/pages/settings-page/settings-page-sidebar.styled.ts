import styled, { css } from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'
import { COLORS } from '@/styles/theme-colors'

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
    flex-direction: row;
    flex-wrap: wrap;
    gap: 6px;
    padding: 4px 0;
  }
`

export const SC_SettingsSidebarItem = styled('button', sidebarItemProps)`
  display: block;
  width: 100%;
  padding: 10px 14px;
  text-align: left;
  font-size: 14px;
  line-height: 1.4;
  color: ${COLORS.GRAY_212};
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;

  &:hover {
    background: ${COLORS.OVERLAY_4};
  }

  ${(p: { active?: boolean }) =>
    p.active &&
    css`
      color: ${COLORS.PRIMARY};
      background: ${COLORS.PRIMARY_BG_SOFT};
      &:hover {
        background: ${COLORS.PRIMARY_BG_12};
      }
    `}

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    width: auto;
    min-width: 110px;
    padding: 8px 12px;
  }
`
