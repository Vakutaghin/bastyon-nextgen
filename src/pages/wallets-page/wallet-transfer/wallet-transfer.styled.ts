import styled from 'vue3-styled-components'
import { Z_INDEX, TRANSITIONS } from '@/styles/design-tokens'

export const SC_TransferWidget = styled.div`
  max-width: 560px;
  background: var(--color-bg-light);
  border: 1px solid var(--color-overlay-8);
  border-radius: var(--ui-radius-lg);
  overflow: hidden;
`

export const SC_TransferSwitch = styled.div`
  display: flex;
  background: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-overlay-8);
`

export const SC_TransferSwitchBtn = styled.button<{ active?: boolean }>`
  flex: 1;
  padding: 14px 20px;
  font-size: 15px;
  font-weight: 600;
  color: ${(p) => (p.active ? 'var(--color-gray-212)' : 'var(--color-gray-120)')};
  background: ${(p) => (p.active ? 'var(--color-bg-light)' : 'transparent')};
  border: none;
  cursor: pointer;
  transition:
    color ${TRANSITIONS.QUICK},
    background ${TRANSITIONS.QUICK};

  &:hover {
    color: var(--color-gray-212);
    background: var(--color-bg-light);
  }
`

export const SC_TransferBody = styled.div`
  padding: 24px;
`

export const SC_TransferField = styled.div`
  margin-bottom: 16px;
`

export const SC_TransferLabel = styled.label`
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-gray-120);
  margin-bottom: 6px;
`

export const SC_TransferInput = styled.input`
  width: 100%;
  padding: 10px 14px;
  font-size: 14px;
  color: var(--color-gray-212);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-overlay-12);
  border-radius: var(--ui-radius-lg);
  box-sizing: border-box;

  &::placeholder {
    color: var(--color-gray-999);
  }

  &:focus {
    outline: none;
    border-color: var(--color-overlay-25);
  }
`

export const SC_TransferTextarea = styled.textarea`
  width: 100%;
  min-height: 72px;
  padding: 10px 14px;
  font-size: 14px;
  color: var(--color-gray-212);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-overlay-12);
  border-radius: var(--ui-radius-lg);
  box-sizing: border-box;
  resize: vertical;

  &::placeholder {
    color: var(--color-gray-999);
  }

  &:focus {
    outline: none;
    border-color: var(--color-overlay-25);
  }
`

export const SC_TransferSelect = styled.select`
  width: 100%;
  padding: 10px 14px;
  font-size: 14px;
  color: var(--color-gray-212);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-overlay-12);
  border-radius: var(--ui-radius-lg);
  cursor: pointer;
  box-sizing: border-box;
`

export const SC_TransferRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
`

/** Контейнер QR на приём: белый фон для контраста (в т.ч. в тёмной теме). */
export const SC_QrWrap = styled.div`
  display: flex;
  justify-content: center;
  margin: 4px 0 12px;

  img {
    width: 200px;
    height: 200px;
    padding: 10px;
    background: var(--color-white);
    border: 1px solid var(--color-border-default);
    border-radius: var(--ui-radius-lg);
  }
`

export const SC_TransferAddress = styled.div`
  flex: 1;
  font-family: var(--font-family-mono);
  font-size: 13px;
  color: var(--color-gray-212);
  word-break: break-all;
  padding: 10px 14px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-overlay-8);
  border-radius: var(--ui-radius-lg);
`

export const SC_TransferCopyBtn = styled.button`
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-gray-212);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-overlay-12);
  border-radius: var(--ui-radius-lg);
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    background: var(--color-bg-tertiary);
  }
`

export const SC_TransferSubmit = styled.button`
  width: 100%;
  margin-top: 20px;
  padding: 12px 20px;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-white);
  background: var(--color-gray-212);
  border: none;
  border-radius: var(--ui-radius-lg);
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--color-gray-333);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

export const SC_TransferError = styled.div`
  margin-top: 12px;
  padding: 12px;
  font-size: 13px;
  color: var(--color-danger-deep);
  background: var(--color-danger-bg-soft);
  border-radius: var(--ui-radius-lg);
`

export const SC_TransferFieldError = styled.div`
  margin-top: 6px;
  font-size: 12px;
  color: var(--color-danger-deep);
`

export const SC_TransferSuccess = styled.div`
  margin-top: 12px;
  padding: 12px;
  font-size: 13px;
  color: var(--color-success-deep);
  background: var(--color-success-bg-soft);
  border-radius: var(--ui-radius-lg);
`

export const SC_TransferSearchWrap = styled.div`
  position: relative;
`

export const SC_TransferSearchDropdown = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  top: 100%;
  margin-top: 4px;
  max-height: 220px;
  overflow-y: auto;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-overlay-12);
  border-radius: var(--ui-radius-lg);
  box-shadow: 0 4px 12px var(--color-overlay-10);
  z-index: ${Z_INDEX.LOCAL_DROPDOWN};
`

export const SC_TransferSearchItem = styled.button`
  display: block;
  width: 100%;
  padding: 10px 14px;
  font-size: 14px;
  text-align: left;
  color: var(--color-gray-212);
  background: none;
  border: none;
  cursor: pointer;
  border-bottom: 1px solid var(--color-overlay-6);

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: var(--color-bg-light);
  }
`

export const SC_TransferSearchingHint = styled.div`
  font-size: 12px;
  color: var(--color-gray-120);
  margin-top: 4px;
`

export const SC_TransferLoginRequired = styled.div`
  color: var(--color-gray-120);
  font-size: 14px;
`

export const SC_TransferLoginChip = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--color-gray-120);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-overlay-8);
  border-radius: var(--ui-radius-lg);
  max-width: fit-content;
`

export const SC_TransferLoginChipText = styled.span`
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SC_TransferLoginChipRemove = styled.button`
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  padding: 0;
  font-size: 14px;
  line-height: 1;
  color: var(--color-gray-120);
  background: none;
  border: none;
  border-radius: var(--ui-radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: var(--color-gray-212);
    background: var(--color-overlay-6);
  }
`
