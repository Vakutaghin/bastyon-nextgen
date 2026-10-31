import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_CommentWithReplies = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  gap: 0;
`

/**
 * Ветка ответов: тонкая линия из-под аватара корневого комментария, ответы —
 * правее неё. На компьютере ответы начинаются там же, где текст корневого
 * (аватар 40 + зазор 10 = 50px: 19 + линия 2 + 29). На телефоне отступ
 * меньше (линия под центром аватара 32px, ответы через 12px от неё), чтобы
 * ветке оставалось почти всё место по ширине.
 */
export const SC_CommentReplies = styled.div`
  /* Зазор сверху — внутренним полем, а не внешним отступом: линия идёт
     без разрыва от открытой над ответами формы ответа (SC_ReplyPanelNested). */
  padding-top: 12px;
  margin-left: 19px;
  padding-left: 29px;
  border-left: 2px solid var(--ui-border);
  display: flex;
  flex-direction: column;
  gap: 12px;

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    padding-top: 10px;
    margin-left: 15px;
    padding-left: 12px;
    gap: 10px;
  }
`

/** Обёртка одного ответа второго уровня: комментарий + плашка ответа под ним */
export const SC_ReplyItemWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0;
`

export const SC_CommentRepliesToggle = styled.button`
  padding: 0;
  border: none;
  background: none;
  font-size: 12px;
  color: var(--color-text-secondary);
  cursor: pointer;
  text-align: left;
  margin-left: 50px;
  margin-top: 10px;
  margin-bottom: 20px;

  &:hover {
    color: var(--color-text-primary);
    text-decoration: underline;
  }

  /* Под ответами — в колонку ответов (15 + линия 2 + 12). */
  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    margin-left: 29px;
    margin-top: 8px;
    margin-bottom: 16px;
    font-size: 13px;
  }
`
