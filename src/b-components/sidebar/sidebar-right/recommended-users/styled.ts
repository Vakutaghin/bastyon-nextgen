import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { TRANSITIONS } from '@/styles/design-tokens'

export const SC_RecRoot = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 24px;
`

export const SC_RecCaption = styled.div`
  font-weight: 600;
  font-size: 15px;
  color: ${COLORS.TEXT_PRIMARY};
  margin-bottom: 12px;
`

export const SC_RecList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

export const SC_RecRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 4px;
  border-radius: 8px;
  transition: background ${TRANSITIONS.FAST};

  &:hover {
    background: ${COLORS.BG_HOVER};
  }
`

export const SC_RecMain = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
`

export const SC_RecAvatar = styled.div`
  width: 34px;
  height: 34px;
  border-radius: 50%;
  flex-shrink: 0;
  overflow: hidden;
  background: ${COLORS.BG_SECONDARY};
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: ${COLORS.TEXT_SECONDARY};

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

export const SC_RecInfo = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`

export const SC_RecName = styled.span`
  font-size: 13px;
  font-weight: 500;
  color: ${COLORS.TEXT_PRIMARY};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const SC_RecMeta = styled.span`
  font-size: 11px;
  color: ${COLORS.TEXT_MUTED};
`

export const SC_RecFollow = styled.button`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid ${COLORS.PRIMARY};
  background: ${COLORS.PRIMARY};
  color: ${COLORS.WHITE};
  font-size: 12px;
  cursor: pointer;
  transition: background ${TRANSITIONS.FAST};

  &:hover:not(:disabled) {
    background: ${COLORS.PRIMARY_HOVER};
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`

export const SC_RecState = styled.div`
  font-size: 13px;
  color: ${COLORS.TEXT_SECONDARY};
  padding: 8px 0;
`
