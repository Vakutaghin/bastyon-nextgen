import styled, { css } from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { TRANSITIONS } from '@/styles/design-tokens'

export const SC_ExplorerSettingsSection = styled.div`
  max-width: 720px;
  display: flex;
  flex-direction: column;
  gap: 24px;
`

export const SC_ExplorerSettingsBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

export const SC_ExplorerSettingsLead = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: ${COLORS.TEXT_SECONDARY};
`

export const SC_ExplorerOpenFullButton = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 22px;
  font-size: 14px;
  font-weight: 500;
  color: ${COLORS.WHITE};
  background: ${COLORS.ANT_BLUE};
  border: none;
  border-radius: 8px;
  cursor: pointer;
  text-decoration: none;
  transition: background ${TRANSITIONS.FAST};
  align-self: flex-start;

  &:hover {
    background: ${COLORS.ANT_BLUE_HOVER};
    color: ${COLORS.WHITE};
  }
`

export const SC_ExplorerNodeList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

const nodeRowProps = { active: Boolean }

export const SC_ExplorerNodeRow = styled('label', nodeRowProps)`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid ${COLORS.BORDER_DEFAULT};
  border-radius: 8px;
  background: ${COLORS.WHITE};
  cursor: pointer;
  font-size: 14px;
  color: ${COLORS.GRAY_212};
  transition:
    background ${TRANSITIONS.QUICK},
    border-color ${TRANSITIONS.QUICK};

  &:hover {
    background: ${COLORS.OVERLAY_2};
    border-color: ${COLORS.ANT_BLUE};
  }

  ${(p: { active?: boolean }) =>
    p.active &&
    css`
      border-color: ${COLORS.ANT_BLUE};
      background: ${COLORS.ANT_BLUE_BG};
    `}
`

export const SC_ExplorerNodeRadio = styled.input`
  margin: 0;
  cursor: pointer;
  accent-color: ${COLORS.ANT_BLUE};
`

export const SC_ExplorerNodeLabel = styled.span`
  flex: 1;
  font-family: 'Courier New', monospace;
  font-size: 13px;
`

export const SC_ExplorerNodeHint = styled.span`
  font-size: 12px;
  color: ${COLORS.TEXT_SECONDARY};
`
