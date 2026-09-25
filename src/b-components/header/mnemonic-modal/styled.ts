import styled from 'vue3-styled-components'

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
  background-color: var(--color-orange-bg);
  border: 1px solid var(--color-warning-border-light);
  border-radius: var(--ui-radius-lg);
  margin-bottom: 20px;
`

export const SC_WarningTitle = styled.div`
  font-weight: 600;
  font-size: 16px;
  color: var(--color-orange-text);
  margin-bottom: 8px;
`

export const SC_WarningText = styled.div`
  font-size: 14px;
  color: var(--color-orange-text);
  line-height: 1.5;
`

export const SC_EquivalenceNote = styled.div`
  font-size: 14px;
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin-bottom: 16px;
`

export const SC_MnemonicBox = styled.div`
  position: relative;
  background-color: var(--color-bg-tertiary);
  border: 1px solid var(--color-border-default);
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
  border: 1px solid var(--color-border-default);
  border-radius: var(--ui-radius-md);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition:
    color var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast);

  &:hover {
    color: var(--color-ant-blue);
    border-color: var(--color-ant-blue);
    background: var(--color-ant-blue-bg);
  }
`

export const SC_MnemonicText = styled.div`
  font-family: var(--font-family-mono);
  font-size: 16px;
  line-height: 1.8;
  color: var(--color-text-primary);
  word-break: break-word;
  user-select: all;
`

export const SC_PrivateKeyBox = styled.div`
  position: relative;
  background-color: var(--color-bg-tertiary);
  border: 1px solid var(--color-border-default);
  border-radius: var(--ui-radius-lg);
  padding: 16px;
  padding-bottom: 48px;
  margin-bottom: 20px;
`

export const SC_PrivateKeyLabel = styled.div`
  font-size: 14px;
  color: var(--color-text-muted);
  margin-bottom: 8px;
  text-align: center;
  font-weight: 500;
`

export const SC_PrivateKeyText = styled.div`
  font-family: var(--font-family-mono);
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text-primary);
  word-break: break-all;
  user-select: all;
`
