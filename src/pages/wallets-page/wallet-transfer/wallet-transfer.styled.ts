import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { Z_INDEX, TRANSITIONS } from '@/styles/design-tokens'

export const SC_TransferWidget = styled.div`
  max-width: 560px;
  background: ${COLORS.BG_LIGHT};
  border: 1px solid ${COLORS.OVERLAY_8};
  border-radius: 12px;
  overflow: hidden;
`

export const SC_TransferSwitch = styled.div`
  display: flex;
  background: ${COLORS.WHITE};
  border-bottom: 1px solid ${COLORS.OVERLAY_8};
`

export const SC_TransferSwitchBtn = styled.button<{ active?: boolean }>`
  flex: 1;
  padding: 14px 20px;
  font-size: 15px;
  font-weight: 600;
  color: ${(p) => (p.active ? '${COLORS.GRAY_212}' : '${COLORS.GRAY_120}')};
  background: ${(p) => (p.active ? '${COLORS.BG_LIGHT}' : 'transparent')};
  border: none;
  cursor: pointer;
  transition:
    color ${TRANSITIONS.QUICK},
    background ${TRANSITIONS.QUICK};

  &:hover {
    color: ${COLORS.GRAY_212};
    background: ${COLORS.BG_LIGHT};
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
  color: ${COLORS.GRAY_120};
  margin-bottom: 6px;
`

export const SC_TransferInput = styled.input`
  width: 100%;
  padding: 10px 14px;
  font-size: 14px;
  color: ${COLORS.GRAY_212};
  background: ${COLORS.WHITE};
  border: 1px solid ${COLORS.OVERLAY_12};
  border-radius: 8px;
  box-sizing: border-box;

  &::placeholder {
    color: ${COLORS.GRAY_999};
  }
  &:focus {
    outline: none;
    border-color: ${COLORS.OVERLAY_25};
  }
`

export const SC_TransferTextarea = styled.textarea`
  width: 100%;
  min-height: 72px;
  padding: 10px 14px;
  font-size: 14px;
  color: ${COLORS.GRAY_212};
  background: ${COLORS.WHITE};
  border: 1px solid ${COLORS.OVERLAY_12};
  border-radius: 8px;
  box-sizing: border-box;
  resize: vertical;

  &::placeholder {
    color: ${COLORS.GRAY_999};
  }
  &:focus {
    outline: none;
    border-color: ${COLORS.OVERLAY_25};
  }
`

export const SC_TransferSelect = styled.select`
  width: 100%;
  padding: 10px 14px;
  font-size: 14px;
  color: ${COLORS.GRAY_212};
  background: ${COLORS.WHITE};
  border: 1px solid ${COLORS.OVERLAY_12};
  border-radius: 8px;
  cursor: pointer;
  box-sizing: border-box;
`

export const SC_TransferRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
`

export const SC_TransferAddress = styled.div`
  flex: 1;
  font-family: ui-monospace, monospace;
  font-size: 13px;
  color: ${COLORS.GRAY_212};
  word-break: break-all;
  padding: 10px 14px;
  background: ${COLORS.WHITE};
  border: 1px solid ${COLORS.OVERLAY_8};
  border-radius: 8px;
`

export const SC_TransferCopyBtn = styled.button`
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 500;
  color: ${COLORS.GRAY_212};
  background: ${COLORS.WHITE};
  border: 1px solid ${COLORS.OVERLAY_12};
  border-radius: 8px;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    background: ${COLORS.BG_TERTIARY};
  }
`

export const SC_TransferSubmit = styled.button`
  width: 100%;
  margin-top: 20px;
  padding: 12px 20px;
  font-size: 15px;
  font-weight: 600;
  color: ${COLORS.WHITE};
  background: ${COLORS.GRAY_212};
  border: none;
  border-radius: 8px;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: ${COLORS.GRAY_333};
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
  color: ${COLORS.DANGER_DEEP};
  background: ${COLORS.DANGER_BG_SOFT};
  border-radius: 8px;
`

export const SC_TransferFieldError = styled.div`
  margin-top: 6px;
  font-size: 12px;
  color: ${COLORS.DANGER_DEEP};
`

export const SC_TransferSuccess = styled.div`
  margin-top: 12px;
  padding: 12px;
  font-size: 13px;
  color: ${COLORS.SUCCESS_DEEP};
  background: ${COLORS.SUCCESS_BG_SOFT};
  border-radius: 8px;
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
  background: ${COLORS.WHITE};
  border: 1px solid ${COLORS.OVERLAY_12};
  border-radius: 8px;
  box-shadow: 0 4px 12px ${COLORS.OVERLAY_10};
  z-index: ${Z_INDEX.LOCAL_DROPDOWN};
`

export const SC_TransferSearchItem = styled.button`
  display: block;
  width: 100%;
  padding: 10px 14px;
  font-size: 14px;
  text-align: left;
  color: ${COLORS.GRAY_212};
  background: none;
  border: none;
  cursor: pointer;
  border-bottom: 1px solid ${COLORS.OVERLAY_6};

  &:last-child {
    border-bottom: none;
  }
  &:hover {
    background: ${COLORS.BG_LIGHT};
  }
`

export const SC_TransferLoginChip = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 8px 12px;
  font-size: 13px;
  color: ${COLORS.GRAY_120};
  background: ${COLORS.WHITE};
  border: 1px solid ${COLORS.OVERLAY_8};
  border-radius: 8px;
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
  color: ${COLORS.GRAY_120};
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: ${COLORS.GRAY_212};
    background: ${COLORS.OVERLAY_6};
  }
`
