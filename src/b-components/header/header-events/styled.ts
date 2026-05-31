import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_EventsWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  transition: background-color 0.2s;
  color: ${COLORS.TEXT_PRIMARY};

  &:hover {
    background-color: ${COLORS.OVERLAY_4};
  }
`

export const SC_PendingEventsMenu = styled.div`
  background: ${COLORS.BG_PRIMARY};
  border-radius: 8px;
  box-shadow: ${COLORS.SHADOW_MD};
  padding: 8px;
  min-width: 250px;
  max-width: 350px;
  max-height: 80vh;
  overflow-y: auto;
`

export const SC_EmptyMessage = styled.div`
  padding: 12px;
  text-align: center;
  color: ${COLORS.GRAY_999};
`

export const SC_EventsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

export const SC_EventItem = styled.div`
  border: 1px solid ${COLORS.GRAY_E8};
  border-radius: 6px;
  padding: 8px 12px;
  background: ${COLORS.BG_INPUT};
`

export const SC_EventHeader = styled.div`
  font-weight: 600;
  font-size: 12px;
  color: ${COLORS.TEXT_SECONDARY};
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 1px;
`

export const SC_EventContent = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
`

export const SC_PostTitle = styled.div`
  font-size: 16px;
  font-weight: 500;
  color: ${COLORS.TEXT_PRIMARY};
  word-break: break-word;
  margin-right: 12px;
  flex: 1;
`

export const SC_RatingDisplay = styled.div`
  display: flex;
  align-items: center;
  background: ${COLORS.BG_PRIMARY};
  padding: 2px 6px;
  border-radius: 12px;
  border: 1px solid ${COLORS.BG_HOVER};
`

export const SC_RatingValue = styled.span`
  font-size: 16px;
  font-weight: 700;
  color: ${COLORS.TEXT_PRIMARY};
`

export const SC_CommentSnippet = styled.div`
  font-size: 13px;
  color: ${COLORS.GRAY_555};
  word-break: break-word;
  white-space: pre-wrap;
  background: ${COLORS.BG_PRIMARY};
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid ${COLORS.BG_HOVER};
  margin-top: 6px;
  max-height: 4.5em;
  overflow: hidden;
  flex: 1;
`
