import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { TRANSITIONS } from '@/styles/design-tokens'

export const SC_Blacklist = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

export const SC_BlacklistTitle = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: ${COLORS.TEXT_PRIMARY};
`

export const SC_BlacklistLead = styled.p`
  margin: 0;
  font-size: 14px;
  color: ${COLORS.TEXT_SECONDARY};
`

export const SC_BlacklistList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

export const SC_BlacklistRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid ${COLORS.BORDER_DEFAULT};
`

export const SC_BlacklistMain = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
`

export const SC_BlacklistAvatar = styled.div`
  width: 36px;
  height: 36px;
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

export const SC_BlacklistName = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: ${COLORS.TEXT_PRIMARY};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const SC_UnblockBtn = styled.button`
  flex-shrink: 0;
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid ${COLORS.BORDER_DEFAULT};
  background: ${COLORS.BG_SECONDARY};
  color: ${COLORS.TEXT_PRIMARY};
  font-size: 13px;
  cursor: pointer;
  transition: background ${TRANSITIONS.FAST};

  &:hover:not(:disabled) {
    background: ${COLORS.BG_HOVER};
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`

export const SC_BlacklistState = styled.div`
  padding: 24px 0;
  text-align: center;
  font-size: 14px;
  color: ${COLORS.TEXT_SECONDARY};
`
