import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { TRANSITIONS } from '@/styles/design-tokens'

export const SC_Footer = styled.footer`
  width: 100%;
  border-top: 1px solid ${COLORS.BORDER_LIGHTER};
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

  a {
    color: ${COLORS.TEXT_SECONDARY};
    font-size: 13px;
    text-decoration: none;
    transition: color ${TRANSITIONS.FAST};
  }

  a:hover {
    color: ${COLORS.PRIMARY};
    text-decoration: underline;
  }
`

export const SC_FooterBrand = styled.div`
  font-size: 12px;
  color: ${COLORS.TEXT_MUTED};
  text-align: center;
`
