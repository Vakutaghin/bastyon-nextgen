import styled, { css } from 'vue3-styled-components'
import { TRANSITIONS } from '@/styles/design-tokens'
import { SC_SettingsSectionTitle } from './settings-page-main.styled'

export const SC_ExplorerSubsectionTitle = styled(SC_SettingsSectionTitle)`
  font-size: 14px;
  margin: 0;
`

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
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-text-secondary);
`

export const SC_ExplorerOpenFullButton = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 22px;
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-text-inverted);
  background: var(--color-ant-blue);
  border: none;
  border-radius: var(--ui-radius-lg);
  cursor: pointer;
  text-decoration: none;
  transition: background ${TRANSITIONS.FAST};
  align-self: flex-start;

  &:hover {
    background: var(--color-ant-blue-hover);
    color: var(--ui-text-inverted);
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
  border: 1px solid var(--color-border-default);
  border-radius: var(--ui-radius-lg);
  background: var(--color-bg-primary);
  cursor: pointer;
  font-size: 14px;
  color: var(--color-gray-212);
  transition:
    background ${TRANSITIONS.QUICK},
    border-color ${TRANSITIONS.QUICK};

  &:hover {
    background: var(--color-overlay-2);
    border-color: var(--color-ant-blue);
  }

  ${(p: { active?: boolean }) =>
    p.active &&
    css`
      border-color: var(--color-ant-blue);
      background: var(--color-ant-blue-bg);
    `}
`

export const SC_ExplorerNodeRadio = styled.input`
  margin: 0;
  cursor: pointer;
  accent-color: var(--color-ant-blue);
`

export const SC_ExplorerNodeLabel = styled.span`
  flex: 1;
  font-family: var(--font-family-mono);
  font-size: 13px;
`

export const SC_ExplorerNodeHint = styled.span`
  font-size: 12px;
  color: var(--color-text-secondary);
`
