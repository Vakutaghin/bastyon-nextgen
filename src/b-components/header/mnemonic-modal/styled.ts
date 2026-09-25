import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

export const SC_MnemonicModalContent = styled.div`
  padding: 20px 0;
`

export const SC_WarningBox = styled.div`
  padding: 16px;
  background-color: ${COLORS.ORANGE_BG};
  border: 1px solid ${COLORS.WARNING_BORDER_LIGHT};
  border-radius: var(--ui-radius-lg);
  margin-bottom: 20px;
`

export const SC_WarningTitle = styled.div`
  font-weight: 600;
  font-size: 16px;
  color: ${COLORS.ORANGE_TEXT};
  margin-bottom: 8px;
`

export const SC_WarningText = styled.div`
  font-size: 13px;
  color: ${COLORS.ORANGE_TEXT};
  line-height: 1.5;
`

export const SC_EquivalenceNote = styled.div`
  font-size: 13px;
  color: ${COLORS.TEXT_SECONDARY};
  line-height: 1.5;
  margin-bottom: 16px;
`

export const SC_MnemonicBox = styled.div`
  position: relative;
  background-color: ${COLORS.BG_TERTIARY};
  border: 1px solid ${COLORS.BORDER_DEFAULT};
  border-radius: var(--ui-radius-lg);
  padding: 16px;
  padding-bottom: 48px;
  margin-bottom: 20px;
  text-align: center;
`

export const SC_CopyIconBtn = styled.button`
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid ${COLORS.BORDER_DEFAULT};
  border-radius: var(--ui-radius-md);
  background: ${COLORS.BG_PRIMARY};
  color: ${COLORS.TEXT_SECONDARY};
  cursor: pointer;
  transition:
    color 0.2s,
    border-color 0.2s,
    background 0.2s;

  &:hover {
    color: ${COLORS.ANT_BLUE};
    border-color: ${COLORS.ANT_BLUE};
    background: ${COLORS.ANT_BLUE_BG};
  }
`

export const SC_MnemonicText = styled.div`
  font-family: var(--font-family-mono);
  font-size: 16px;
  line-height: 1.8;
  color: ${COLORS.TEXT_PRIMARY};
  word-break: break-word;
  user-select: all;
`

export const SC_PrivateKeyBox = styled.div`
  position: relative;
  background-color: ${COLORS.BG_TERTIARY};
  border: 1px solid ${COLORS.BORDER_DEFAULT};
  border-radius: var(--ui-radius-lg);
  padding: 16px;
  padding-bottom: 48px;
  margin-bottom: 20px;
`

export const SC_PrivateKeyLabel = styled.div`
  font-size: 14px;
  color: ${COLORS.TEXT_MUTED};
  margin-bottom: 8px;
  text-align: center;
  font-weight: 900;
`

export const SC_PrivateKeyText = styled.div`
  font-family: var(--font-family-mono);
  font-size: 14px;
  line-height: 1.6;
  color: ${COLORS.TEXT_PRIMARY};
  word-break: break-all;
  user-select: all;
`
