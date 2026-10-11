import styled from 'vue3-styled-components'

/** Занимает всю середину шапки, чтобы длинное имя обрезалось, а не выталкивало кнопки. */
export const SC_PartnerTitle = styled.div`
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
`

export const SC_PartnerTitleName = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--ui-text-highlighted);
`
