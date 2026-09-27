import styled from 'vue3-styled-components'

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

export const SC_FooterBrand = styled.div`
  font-size: 12px;
  color: var(--ui-text-dimmed);
  text-align: center;
`
