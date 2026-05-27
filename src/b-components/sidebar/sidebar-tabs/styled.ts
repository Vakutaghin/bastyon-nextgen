import styled, { css } from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

const tabProps = {
  active: Boolean,
  disabled: Boolean,
}

export const SC_Tabs = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-bottom: 10px;
  border-bottom: 1px solid ${COLORS.BG_SECONDARY};

  &.collapsed {
    padding-bottom: 12px;
    border-bottom-color: ${COLORS.BORDER_LIGHTER};
  }

  &.collapsed button {
    justify-content: center;
    padding: 10px;
  }
`

export const SC_TabsItem = styled('button', tabProps)`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11.25px 15px;
  border-radius: 8px;
  background: none;
  border: none;
  cursor: pointer;
  transition: all 0.3s;
  color: ${COLORS.TEXT_PRIMARY};
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  position: relative;
  opacity: 1;
  width: 100%;

  /* Target both AntD icon wrapper and potential direct SVGs */
  & > .anticon,
  & > svg {
    font-size: 16px;
    width: 20px;
    flex-shrink: 0;
  }

  &:hover {
    background: ${COLORS.BG_SECONDARY};
    color: ${COLORS.PRIMARY};
  }

  ${(props) =>
    props.active &&
    css`
      background: rgba(0, 123, 255, 0.1);
      color: ${COLORS.PRIMARY};
      font-weight: 600;

      &::before {
        content: '';
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 3px;
        height: 60%;
        background: ${COLORS.PRIMARY};
        border-radius: 0 2px 2px 0;
      }

      &:hover {
        background: rgba(0, 123, 255, 0.15);
      }
    `}

  ${(props) =>
    props.disabled &&
    css`
      cursor: not-allowed;
      color: ${COLORS.TEXT_MUTED};
      opacity: 0.6;

      &:hover {
        background: none;
        color: ${COLORS.TEXT_MUTED};
      }
    `}
`

export const SC_TabsLabel = styled.span`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
`

// ─── Favorites (закреплённые миниаппы) ────────────────────────────────────────

export const SC_FavoritesSection = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-bottom: 24px;

  &.collapsed button {
    justify-content: center;
    padding: 8px;
  }
`

const favItemProps = { active: Boolean }

export const SC_FavoritesItem = styled('button', favItemProps)`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 15px;
  border-radius: 8px;
  background: none;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  color: ${COLORS.TEXT_PRIMARY};
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  position: relative;
  width: 100%;

  &:hover {
    background: ${COLORS.BG_SECONDARY};
  }

  ${(props) =>
    props.active &&
    css`
      background: rgba(0, 123, 255, 0.1);
      color: ${COLORS.PRIMARY};
      font-weight: 600;

      &::before {
        content: '';
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 3px;
        height: 60%;
        background: ${COLORS.PRIMARY};
        border-radius: 0 2px 2px 0;
      }

      &:hover {
        background: rgba(0, 123, 255, 0.15);
      }
    `}
`

export const SC_FavIconWrap = styled.div`
  width: 20px;
  height: 20px;
  border-radius: 4px;
  overflow: hidden;
  flex: 0 0 auto;
  background: ${COLORS.BG_SECONDARY};
  display: flex;
  align-items: center;
  justify-content: center;
`

export const SC_FavIcon = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`

export const SC_FavIconFallback = styled.div`
  font-size: 10px;
  font-weight: 600;
  color: ${COLORS.TEXT_SECONDARY};
`

export const SC_FavLabel = styled.span`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
`
