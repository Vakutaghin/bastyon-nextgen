import styled from 'vue3-styled-components'
import { RouterLink } from 'vue-router'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_Buy = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`

/** Калькулятор и адрес — рядом на широком экране, друг под другом на телефоне. */
export const SC_TopGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 14px;
`

export const SC_Card = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  padding: 20px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-xl);
  background: var(--ui-bg);

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    padding: 16px;
  }
`

export const SC_Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

export const SC_Head = styled.h2`
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_HeadIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--ui-radius-lg);
  font-size: 16px;
  color: var(--ui-primary);
  background: rgb(var(--ui-primary-rgb) / 12%);
`

export const SC_Text = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.55;
  color: var(--ui-text-toned);
`

export const SC_Muted = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--ui-text-muted);
`

/* Калькулятор */

export const SC_CalcRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

export const SC_CalcField = styled.label`
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  background: var(--ui-bg-elevated);

  &:focus-within {
    border-color: var(--ui-primary);
  }

  input {
    flex: 1;
    min-width: 0;
    padding: 10px 12px;
    border: none;
    background: transparent;
    font-size: 16px;
    color: var(--ui-text-highlighted);
    outline: none;
  }
`

export const SC_CalcUnit = styled.span`
  padding-right: 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-text-muted);
`

export const SC_CalcSwap = styled.span`
  flex: 0 0 auto;
  font-size: 16px;
  color: var(--ui-text-muted);
`

/* Адрес */

export const SC_AddressRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`

export const SC_Address = styled.code`
  flex: 1;
  min-width: 0;
  padding: 10px 12px;
  border-radius: var(--ui-radius-lg);
  background: var(--ui-bg-elevated);
  font-size: 13px;
  color: var(--ui-text-highlighted);
  overflow-wrap: anywhere;
  user-select: all;
`

export const SC_Button = styled.button`
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  padding: 9px 14px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  background: var(--ui-bg);
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-text-highlighted);
  cursor: pointer;
  transition: var(--transition-fast);

  &:hover {
    border-color: var(--ui-primary);
    color: var(--ui-primary);
  }
`

export const SC_AddressBody = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 14px;

  img {
    flex: 0 0 auto;
    width: 112px;
    height: 112px;
    padding: 6px;
    border: 1px solid var(--color-border-default);
    border-radius: var(--ui-radius-lg);
    background: var(--color-white);
  }

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    flex-direction: column;
    align-items: center;
  }
`

export const SC_AddressMain = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  width: 100%;
`

/* Площадки */

export const SC_Venues = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
`

const venueCss = `
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  padding: 14px 16px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-xl);
  background: var(--ui-bg);
  color: inherit;
  text-decoration: none;
  transition: var(--transition-fast);

  &:hover {
    color: inherit;
    border-color: rgb(var(--ui-primary-rgb) / 50%);
    background: rgb(var(--ui-primary-rgb) / 4%);
  }
`

export const SC_VenueLink = styled.a`
  ${() => venueCss}
`

export const SC_VenueRoute = styled(RouterLink)`
  ${() => venueCss}
`

export const SC_VenueBadge = styled.span`
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--ui-radius-lg);
  font-size: 18px;
  font-weight: 700;
  color: var(--ui-primary);
  background: rgb(var(--ui-primary-rgb) / 12%);
`

export const SC_VenueBody = styled.span`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`

export const SC_VenueName = styled.span`
  font-size: 15px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_VenueMeta = styled.span`
  font-size: 13px;
  line-height: 1.45;
  color: var(--ui-text-muted);
`

export const SC_VenueAction = styled.span`
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-primary);
`

export const SC_ExtLink = styled.a`
  align-self: flex-start;
  font-size: 13px;
  color: var(--ui-primary);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`

/** Предупреждение о сделках из рук в руки — тон врезки WARNING справки. */
export const SC_Risk = styled.div`
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid rgb(var(--ui-warning-rgb) / 35%);
  border-radius: var(--ui-radius-lg);
  background: rgb(var(--ui-warning-rgb) / 8%);
  font-size: 14px;
  line-height: 1.55;
  color: var(--ui-text-toned);

  .anticon {
    flex: 0 0 auto;
    margin-top: 2px;
    font-size: 18px;
    color: var(--ui-warning-text);
  }

  strong {
    display: block;
    margin-bottom: 2px;
    color: var(--ui-text-highlighted);
  }
`

/* Полезное */

export const SC_Tools = styled.ul`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const SC_Tool = styled(RouterLink)`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--ui-radius-lg);
  font-size: 14px;
  color: var(--ui-text-highlighted);
  text-decoration: none;
  transition: var(--transition-fast);

  .anticon {
    font-size: 16px;
    color: var(--ui-text-muted);
  }

  &:hover {
    color: var(--ui-primary);
    background: var(--ui-bg-elevated);
  }

  &:hover .anticon {
    color: var(--ui-primary);
  }
`

export const SC_ToolHelp = styled.li`
  display: flex;
  align-items: center;
  padding: 10px 12px;
  font-size: 14px;
`
