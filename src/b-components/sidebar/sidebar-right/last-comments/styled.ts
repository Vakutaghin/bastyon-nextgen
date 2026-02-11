import styled from 'vue3-styled-components'

export const SC_LastCommentsRoot = styled.div`
  display: flex;
  flex-direction: column;
`

export const SC_LastCommentsCaption = styled.div`
  font-weight: 600;
  font-size: 15px;
  color: rgb(33, 37, 41);
  margin-bottom: 12px;
`

export const SC_LastCommentsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

export const SC_LastCommentItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
  cursor: pointer;
  padding: 8px 0;
  border-bottom: 1px solid rgba(206, 212, 218, 0.3);

  &:last-child {
    border-bottom: 0;
  }

  &:hover {
    opacity: 0.85;
  }
`

export const SC_LastCommentIcons = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
`

export const SC_LastCommentAvatar = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  overflow: hidden;
  background: rgb(222, 226, 230);
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`

export const SC_LastCommentLetter = styled.span`
  color: rgb(33, 37, 41);
  font-weight: 600;
  font-size: 12px;
`

export const SC_LastCommentArrow = styled.i`
  font-size: 10px;
  color: rgba(33, 37, 41, 0.5);
  flex-shrink: 0;
`

export const SC_LastCommentContent = styled.div`
  flex: 1;
  min-width: 0;
  font-size: 13px;
  line-height: 1.4;
  color: rgb(33, 37, 41);
`

export const SC_LastCommentNames = styled.span`
  font-weight: 600;
  color: rgb(33, 37, 41);
`

export const SC_LastCommentMessage = styled.span`
  color: rgb(73, 80, 87);
`

export const SC_LastCommentsLoading = styled.div`
  padding: 16px 0;
  color: rgb(134, 142, 150);
  font-size: 13px;
`

export const SC_LastCommentsEmpty = styled.div`
  padding: 16px 0;
  color: rgb(134, 142, 150);
  font-size: 13px;
`
