import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_PostPage = styled.div`
  width: 100%;
  display: flex;
  justify-content: center;
`

export const SC_PostPageInner = styled.div`
  width: 100%;
  max-width: 680px;
  /* Под шапкой: без отступа от неё начало поста было скрыто. */
  padding: calc(var(--header-height-total) + 16px) 16px 16px;
  box-sizing: border-box;

  /* Телефон: пост перекрывает поля страницы и встаёт во всю ширину. */
  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    --page-gutter: 16px;
  }
`

export const SC_PostStatus = styled.div`
  padding: 48px 16px;
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 14px;
`
