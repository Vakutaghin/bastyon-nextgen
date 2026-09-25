import styled from 'vue3-styled-components'
import { TRANSITIONS } from '@/styles/design-tokens'

export const SC_PrivateKeySection = styled.div`
  max-width: 560px;
`

export const SC_PrivateKeyWarning = styled.div`
  padding: 12px 16px;
  background-color: var(--color-warning-bg);
  border: 1px solid var(--color-warning-border);
  border-radius: var(--ui-radius-lg);
  margin-bottom: 20px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--color-warning-text);
`

export const SC_PrivateKeyBox = styled.div`
  position: relative;
  background-color: var(--color-bg-tertiary);
  border: 1px solid var(--color-border-default);
  border-radius: var(--ui-radius-lg);
  padding: 16px;
  padding-bottom: 48px;
  margin-bottom: 16px;
`

export const SC_PrivateKeyLabel = styled.div`
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
  font-weight: 600;
`

export const SC_PrivateKeyValue = styled.div`
  font-family: var(--font-family-mono);
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text-primary);
  word-break: break-all;
  user-select: all;
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
    color ${TRANSITIONS.FAST},
    border-color ${TRANSITIONS.FAST},
    background ${TRANSITIONS.FAST};

  &:hover {
    color: var(--color-ant-blue);
    border-color: var(--color-ant-blue);
    background: var(--color-ant-blue-bg);
  }
`

export const SC_ShowKeyButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-white);
  background: var(--color-ant-blue);
  border: none;
  border-radius: var(--ui-radius-lg);
  cursor: pointer;
  transition: background ${TRANSITIONS.FAST};

  &:hover {
    background: var(--color-ant-blue-hover);
  }

  &:disabled {
    background: var(--color-border-default);
    cursor: not-allowed;
  }
`

export const SC_HideKeyButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  background: transparent;
  border: 1px solid var(--color-border-default);
  border-radius: var(--ui-radius-md);
  cursor: pointer;
  transition:
    color ${TRANSITIONS.FAST},
    border-color ${TRANSITIONS.FAST};

  &:hover {
    color: var(--color-ant-blue);
    border-color: var(--color-ant-blue);
  }
`

export const SC_ConfirmOverlay = styled.div`
  padding: 20px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-warning-border-light);
  border-radius: var(--ui-radius-lg);
  max-width: 480px;
`

export const SC_ConfirmTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-orange-text);
  margin-bottom: 12px;
`

export const SC_ConfirmText = styled.p`
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-gray-212);
  margin: 0 0 16px;
`

export const SC_ConfirmButtons = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
`

export const SC_ConfirmBtnPrimary = styled.button`
  padding: 8px 20px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-white);
  background: var(--color-ant-blue);
  border: none;
  border-radius: var(--ui-radius-md);
  cursor: pointer;
  transition: background ${TRANSITIONS.FAST};

  &:hover {
    background: var(--color-ant-blue-hover);
  }
`

export const SC_ConfirmBtnDefault = styled.button`
  padding: 8px 20px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-default);
  border-radius: var(--ui-radius-md);
  cursor: pointer;
  transition:
    color ${TRANSITIONS.FAST},
    border-color ${TRANSITIONS.FAST};

  &:hover {
    color: var(--color-ant-blue);
    border-color: var(--color-ant-blue);
  }
`
