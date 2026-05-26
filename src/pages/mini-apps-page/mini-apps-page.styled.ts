import styled from 'vue3-styled-components'

export const SC_Page = styled.div`
  width: 100%;
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: var(--header-height-total) var(--content-padding-x) 24px;
  min-height: calc(100vh - var(--header-height));
  background: rgb(255, 255, 255);
`

export const SC_Title = styled.h1`
  font-size: 22px;
  font-weight: 600;
  color: rgb(33, 33, 33);
  margin: 24px 0 8px;
`

export const SC_Subtitle = styled.p`
  font-size: 13px;
  color: rgba(0, 0, 0, 0.55);
  margin: 0 0 16px;
`
