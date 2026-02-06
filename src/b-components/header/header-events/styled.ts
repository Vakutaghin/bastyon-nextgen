import styled from 'vue3-styled-components'

export const SC_EventsWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  transition: background-color 0.2s;
  color: var(--text-primary, #000);

  &:hover {
    background-color: rgba(0, 0, 0, 0.04);
  }
`

export const SC_PendingEventsMenu = styled.div`
  background: #fff;
  border-radius: 8px;
  box-shadow: 1px 6px -4px rgba(0, 0, 0, 0.12), 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 9px 28px 8px rgba(0, 0, 0, 0.05);
  padding: 8px;
  min-width: 250px;
  max-width: 350px;
  max-height: 80vh;
  overflow-y: auto;
`

export const SC_EmptyMessage = styled.div`
  padding: 12px;
  text-align: center;
  color: #999;
`

export const SC_EventsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

export const SC_EventItem = styled.div`
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  padding: 8px 12px;
  background: #fafafa;
`

export const SC_EventHeader = styled.div`
  font-weight: 600;
  font-size: 12px;
  color: #666;
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
  color: #333;
  word-break: break-word;
  margin-right: 12px;
  flex: 1;
`

export const SC_RatingDisplay = styled.div`
  display: flex;
  align-items: center;
  background: #fff;
  padding: 2px 6px;
  border-radius: 12px;
  border: 1px solid #f0f0f0;
`

export const SC_RatingValue = styled.span`
  font-size: 16px;
  font-weight: 700;
  color: #333;
`
