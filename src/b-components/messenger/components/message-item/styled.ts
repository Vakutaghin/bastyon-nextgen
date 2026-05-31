import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_MessageItem = styled.div`
  max-width: 80%;
  min-width: 0;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.4;
  position: relative;
  white-space: pre-wrap;
  word-break: break-word;
  box-sizing: border-box;
  overflow: hidden;

  &.mine {
    background-color: ${COLORS.ANT_BLUE_BG};
    color: ${COLORS.TEXT_PRIMARY};
    border-bottom-right-radius: 4px;
  }

  &.others {
    background-color: ${COLORS.GRAY_F1};
    color: ${COLORS.TEXT_PRIMARY};
    border-bottom-left-radius: 4px;
  }
`

export const SC_MessageTime = styled.span`
  font-size: 10px;
  opacity: 0.7;
  display: block;
  text-align: right;
  margin-top: 4px;
`

export const SC_MessageRow = styled.div`
  display: flex;
  width: 100%;
  align-items: flex-end;
  gap: 8px;

  &.mine {
    justify-content: flex-end;
  }

  &.others {
    justify-content: flex-start;
  }
`

/** Слот для аватарки слева от чужого сообщения. Сохраняет место даже когда аватарка пустая, чтобы пузыри стояли ровно. */
export const SC_AvatarSlot = styled.div`
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
`

export const SC_MessageMeta = styled.div`
  font-size: 11px;
  opacity: 0.7;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
`

export const SC_ReactionsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
`

export const SC_ReactionPill = styled.span`
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 10px;
  background: ${COLORS.OVERLAY_6};
  cursor: default;
  display: inline-flex;
  align-items: center;
  gap: 2px;

  &.mine {
    background: ${COLORS.PRIMARY_LIGHT_15};
  }
`

export const SC_ReactionButton = styled.button`
  padding: 2px 6px;
  margin-left: 4px;
  border: none;
  background: transparent;
  cursor: pointer;
  opacity: 0.6;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;

  &:hover {
    opacity: 1;
    background: ${COLORS.OVERLAY_6};
  }
`

export const SC_ReactionPicker = styled.div`
  position: absolute;
  bottom: 100%;
  right: 0;
  margin-bottom: 4px;
  padding: 6px 8px;
  background: ${COLORS.BG_PRIMARY};
  border-radius: 12px;
  box-shadow: ${COLORS.SHADOW_MD};
  display: flex;
  gap: 4px;
  z-index: 10;
`

export const SC_ReactionPickerEmoji = styled.button`
  padding: 4px 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 18px;
  border-radius: 6px;

  &:hover {
    background: ${COLORS.OVERLAY_6};
  }
`
