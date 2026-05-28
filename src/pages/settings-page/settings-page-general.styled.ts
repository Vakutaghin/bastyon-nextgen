import styled, { css } from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

const langRowProps = { active: Boolean }

export const SC_GeneralBlock = styled.div`
  max-width: 480px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`

export const SC_GeneralRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
  border-bottom: 1px solid ${COLORS.OVERLAY_6};

  &:last-child {
    border-bottom: none;
  }
`

export const SC_GeneralLabel = styled.span`
  font-size: 14px;
  color: ${COLORS.GRAY_212};
`

export const SC_LangSwitcher = styled.div`
  display: inline-flex;
  border: 1px solid ${COLORS.BORDER};
  border-radius: 8px;
  overflow: hidden;
`

export const SC_LangButton = styled('button', langRowProps)`
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  background: transparent;
  color: ${COLORS.TEXT_SECONDARY};
  border: none;
  cursor: pointer;
  transition: background-color 0.15s;

  & + & {
    border-left: 1px solid ${COLORS.BORDER};
  }

  ${(p: { active?: boolean }) =>
    p.active &&
    css`
      background: ${COLORS.PRIMARY};
      color: ${COLORS.WHITE};
    `}

  &:hover {
    background: ${(p: { active?: boolean }) => (p.active ? COLORS.PRIMARY : COLORS.PRIMARY_LIGHT)};
    color: ${(p: { active?: boolean }) => (p.active ? COLORS.WHITE : COLORS.PRIMARY)};
  }
`
