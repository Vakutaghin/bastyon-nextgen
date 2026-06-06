import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { TRANSITIONS } from '@/styles/design-tokens'

export const SC_Perms = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

export const SC_PermsTitle = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: ${COLORS.TEXT_PRIMARY};
`

export const SC_PermsLead = styled.p`
  margin: 0;
  font-size: 14px;
  color: ${COLORS.TEXT_SECONDARY};
`

export const SC_PermsState = styled.div`
  padding: 24px 0;
  text-align: center;
  font-size: 14px;
  color: ${COLORS.TEXT_SECONDARY};
`

export const SC_AppCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid ${COLORS.BORDER_DEFAULT};
  border-radius: 10px;
`

export const SC_AppHead = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`

export const SC_AppIcon = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 8px;
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

export const SC_AppName = styled.span`
  flex: 1;
  min-width: 0;
  font-size: 15px;
  font-weight: 600;
  color: ${COLORS.TEXT_PRIMARY};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const SC_PermRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  border-top: 1px solid ${COLORS.BORDER_LIGHTER};
`

export const SC_PermInfo = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
`

export const SC_PermName = styled.span`
  font-size: 14px;
  color: ${COLORS.TEXT_PRIMARY};
`

export const SC_PermMeta = styled.span`
  font-size: 12px;
  color: ${COLORS.TEXT_MUTED};
`

export const SC_DeniedBadge = styled.span`
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 10px;
  background: ${COLORS.RED_BG};
  color: ${COLORS.DANGER};
`

export const SC_RevokeBtn = styled.button`
  flex-shrink: 0;
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid ${COLORS.BORDER_DEFAULT};
  background: ${COLORS.BG_SECONDARY};
  color: ${COLORS.DANGER};
  font-size: 13px;
  cursor: pointer;
  transition: background ${TRANSITIONS.FAST};

  &:hover {
    background: ${COLORS.BG_HOVER};
  }
`

export const SC_RevokeAllBtn = styled.button`
  flex-shrink: 0;
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid ${COLORS.BORDER_DEFAULT};
  background: none;
  color: ${COLORS.TEXT_SECONDARY};
  font-size: 13px;
  cursor: pointer;
  transition: background ${TRANSITIONS.FAST};

  &:hover {
    background: ${COLORS.BG_HOVER};
  }
`
