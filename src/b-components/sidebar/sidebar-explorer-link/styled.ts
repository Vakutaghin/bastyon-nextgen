import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_ExplorerLink = styled.div`
  margin-top: 16px;
`

export const SC_ExplorerHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 11px;
`

export const SC_ExplorerTitle = styled.h3`
  font-size: 13px;
  font-weight: 600;
  color: ${COLORS.TEXT_PRIMARY};
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 1px;
`

export const SC_ExplorerCard = styled.a`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: ${COLORS.PRIMARY_LIGHT};
  border: 1px solid ${COLORS.PRIMARY_LIGHT_30};
  border-radius: 10px;
  text-decoration: none;
  color: ${COLORS.PRIMARY};
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;

  &:hover {
    background: ${COLORS.PRIMARY_LIGHT_15};
    border-color: ${COLORS.PRIMARY_LIGHT_50};
  }
`

export const SC_ExplorerIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: ${COLORS.BG_PRIMARY};
  border-radius: 8px;
  color: ${COLORS.PRIMARY};
  flex-shrink: 0;
`

export const SC_ExplorerTextWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`

export const SC_ExplorerLabel = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: ${COLORS.PRIMARY};
  line-height: 1.2;
`

export const SC_ExplorerHint = styled.span`
  font-size: 11px;
  color: ${COLORS.TEXT_SECONDARY};
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`
