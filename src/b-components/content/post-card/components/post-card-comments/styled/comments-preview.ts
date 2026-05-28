import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_CommentsPreview = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  margin-top: 12px;
  border-top: 1px solid ${COLORS.BORDER_LIGHT};
  padding-top: 12px;
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

/** Кнопка ручного обновления списка комментариев */
export const SC_RefreshBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid #ddd;
  background: #fff;
  color: ${COLORS.TEXT_SECONDARY};
  cursor: pointer;
  margin-left: auto;

  &:hover:not(:disabled) {
    background: #f5f5f5;
    color: ${COLORS.TEXT_PRIMARY};
  }
  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  svg {
    width: 14px;
    height: 14px;
  }
`

export const SC_CommentsSortSelect = styled.select`
  font-size: 13px;
  color: ${COLORS.TEXT_PRIMARY};
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

export const SC_CommentRepliesLink = styled.button`
  appearance: none;
  border: none;
  padding: 0;
  margin: 0;
  background: transparent;
  font: inherit;
  text-align: inherit;
  font-size: 13px;
  color: #00a4ff;
  cursor: pointer;
  user-select: none;

  &:hover {
    text-decoration: underline;
  }
`
