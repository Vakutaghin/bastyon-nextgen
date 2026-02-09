import styled from 'vue3-styled-components'

export const SC_CommentsPreview = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  margin-top: 12px;
  border-top: 1px solid rgba(206, 212, 218, 0.5);
  padding-top: 12px;
`

export const SC_CommentRow = styled.div`
  display: flex;
  gap: 10px;
  align-items: flex-start;
  width: 100%;

  a {
    border-bottom: 0;
    text-decoration: none;
    color: inherit;
  }

  .comment-avatar,
  .comment-avatar-placeholder {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    background: rgb(222, 226, 230);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .comment-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .comment-avatar-placeholder {
    color: rgb(33, 37, 41);
    font-weight: 600;
    font-size: 13px;
  }
`

export const SC_CommentItem = styled.div`
  display: flex;
  gap: 10px;
  align-items: flex-start;

  a {
    border-bottom: 0;
    text-decoration: none;
    color: inherit;
  }

  .comment-avatar,
  .comment-avatar-placeholder {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    background: rgb(222, 226, 230);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .comment-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .comment-avatar-placeholder {
    color: rgb(33, 37, 41);
    font-weight: 600;
    font-size: 13px;
  }
`

export const SC_CommentAuthor = styled.div`
  font-weight: 600;
  font-size: 13px;
  color: rgb(33, 37, 41);
`

export const SC_CommentText = styled.div`
  font-size: 14px;
  color: rgb(33, 37, 41) !important;
  line-height: 1.5;
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;

  :deep(.bastyon-link) {
    color: rgb(0, 123, 255) !important;
    text-decoration: underline;
    cursor: pointer;
    word-break: break-all;
    overflow-wrap: break-word;
    word-wrap: break-word;
  }

  a {
    border-bottom: 1px solid rgb(0, 123, 255);
  }
`

export const SC_CommentContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
`

export const SC_CommentMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;

  a {
    border-bottom: 0;
    text-decoration: none;
    color: inherit;
  }
`

export const SC_CommentDate = styled.div`
  font-size: 12px;
  color: rgb(108, 117, 125);
`

export const SC_CommentActions = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 2px;

  span {
    font-size: 14px;
    color: rgb(108, 117, 125);
    cursor: pointer;
    user-select: none;
  }

  .comment-score {
    filter: grayscale(1);
    cursor: default;
  }
  .comment-score.comment-score--voted {
    filter: none;
  }
  .comment-score.comment-score--clickable {
    cursor: pointer;
  }
`

export const SC_ShowCommentsBtn = styled.button`
  display: inline-block;
  padding: 0;
  border: none;
  background: none;
  font-size: 13px;
  color: #00a4ff;
  cursor: pointer;
  text-align: left;

  &:hover:not(:disabled) {
    text-decoration: underline;
  }

  &:disabled {
    cursor: default;
  }
`

export const SC_ShowCommentsBtnSecondary = styled(SC_ShowCommentsBtn)`
  color: rgba(0, 0, 0, 0.45);
  margin-left: 12px;

  &:hover:not(:disabled) {
    color: rgba(0, 0, 0, 0.65);
  }
`

export const SC_ShowCommentsBtnCollapse = styled(SC_ShowCommentsBtn)`
  color: rgba(0, 0, 0, 0.45);

  &:hover:not(:disabled) {
    color: rgba(0, 0, 0, 0.65);
  }
`

export const SC_CommentsActionsRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
`

export const SC_CommentsActionsLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

export const SC_CommentsLoading = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 20px;
`

export const SC_CommentsSortRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
`

export const SC_CommentsSortSelect = styled.select`
  font-size: 13px;
  color: rgb(33, 37, 41);
  padding: 4px 8px;
  border: 1px solid rgb(222, 226, 230);
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  min-width: 180px;

  &:focus {
    outline: none;
    border-color: #00a4ff;
  }
`

export const SC_CommentRepliesLink = styled.span`
  font-size: 13px;
  color: #00a4ff;
  cursor: pointer;
  user-select: none;

  &:hover {
    text-decoration: underline;
  }
`

export const SC_CommentWithReplies = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  gap: 0;
`

export const SC_CommentReplies = styled.div`
  margin-left: 24px;
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`

export const SC_CommentRepliesToggle = styled.button`
  margin-top: 4px;
  padding: 0;
  border: none;
  background: none;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  cursor: pointer;
  text-align: left;

  &:hover {
    color: rgba(0, 0, 0, 0.65);
    text-decoration: underline;
  }
`
