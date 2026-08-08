import styled from 'vue3-styled-components'

import { COLORS } from '@/styles/theme-colors'

export const SC_CommentWithReplies = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  gap: 0;
`

export const SC_CommentReplies = styled.div`
  margin-left: 50px;
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`

/** Обёртка одного ответа второго уровня: комментарий + плашка ответа под ним */
export const SC_ReplyItemWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0;
`

export const SC_CommentRepliesToggle = styled.button`
  margin-top: 4px;
  padding: 0;
  border: none;
  background: none;
  font-size: 12px;
  color: ${COLORS.TEXT_SECONDARY};
  cursor: pointer;
  text-align: left;
  margin-left: 50px;
  margin-top: 10px;
  margin-bottom: 20px;

  &:hover {
    color: ${COLORS.TEXT_PRIMARY};
    text-decoration: underline;
  }
`
