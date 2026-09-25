import styled from 'vue3-styled-components'
import { TRANSITIONS } from '@/styles/design-tokens'

export const SC_Footer = styled.footer`
  width: 100%;
  border-top: 1px solid var(--ui-border);
  padding: 16px;
  margin-top: auto;
`

export const SC_FooterInner = styled.div`
  max-width: var(--content-max-width);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
`

export const SC_FooterLinks = styled.nav`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px 16px;

  /* Ссылки футера как у Nuxt: приглушённые, на hover — основной цвет текста. */
  a {
    color: var(--ui-text-muted);
    font-size: 14px;
    text-decoration: none;
    transition: color ${TRANSITIONS.FAST};
  }

  a:hover {
    color: var(--ui-text-highlighted);
    text-decoration: none;
  }
`

export const SC_FooterBrand = styled.div`
  font-size: 12px;
  color: var(--ui-text-dimmed);
  text-align: center;
`
