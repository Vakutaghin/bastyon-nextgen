import styled from 'vue3-styled-components'
import { RouterLink } from 'vue-router'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_MonetizationWork = styled.div`
  display: flex;
  flex: 1;
  width: 100%;
  min-height: calc(100vh - var(--header-height));
  padding: 0 0 32px;
  align-items: flex-start;
  background: var(--color-bg-primary);
`

export const SC_MonetizationPage = styled.main`
  display: flex;
  flex-direction: column;
  gap: 28px;
  width: 100%;
  max-width: 1000px;
  margin: 0 auto;
  padding: calc(var(--header-height-total) + 24px) var(--content-padding-x) 24px;

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    gap: 20px;
    padding-top: calc(var(--header-height-total) + 12px);
  }
`

/* Шапка страницы: значок монет, заголовок, суть в двух фразах и путь в справку. */
export const SC_Hero = styled.section`
  display: flex;
  gap: 20px;
  padding: 28px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-2xl);
  background:
    linear-gradient(135deg, rgb(var(--ui-primary-rgb) / 12%), rgb(var(--ui-success-rgb) / 8%)),
    var(--ui-bg);

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    flex-direction: column;
    gap: 14px;
    padding: 20px 16px;
  }
`

export const SC_HeroIcon = styled.div`
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: var(--ui-radius-xl);
  font-size: 28px;
  color: var(--ui-primary);
  background: rgb(var(--ui-primary-rgb) / 14%);

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    width: 48px;
    height: 48px;
    font-size: 24px;
  }
`

export const SC_HeroBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
`

export const SC_Title = styled.h1`
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  line-height: 1.25;
  color: var(--ui-text-highlighted);

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    font-size: 21px;
  }
`

export const SC_Lead = styled.p`
  margin: 0;
  max-width: 640px;
  font-size: 16px;
  line-height: 1.55;
  color: var(--ui-text-toned);
`

export const SC_HeroActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
`

export const SC_Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 14px;
`

export const SC_SectionTitle = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

/* Карточки «кто, когда, как вывести, как больше»: две колонки, на телефоне одна. */
export const SC_Cards = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;

  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    grid-template-columns: minmax(0, 1fr);
  }
`

export const SC_Card = styled.section`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 20px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-xl);
  background: var(--ui-bg);

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    padding: 16px;
  }
`

export const SC_CardHead = styled.h3`
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_CardIcon = styled.span`
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--ui-radius-lg);
  font-size: 17px;
  color: var(--ui-text-toned);
  background: var(--ui-bg-elevated);

  &.verified {
    color: var(--ui-mark-verified);
    background: rgb(var(--ui-mark-verified-rgb) / 12%);
  }
`

export const SC_CardText = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.55;
  color: var(--ui-text-toned);
`

export const SC_CardList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding-left: 20px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ui-text-toned);
`

export const SC_CardFooter = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: auto;
  padding-top: 4px;
  font-size: 14px;
  color: var(--ui-text-muted);
`

export const SC_InlineLink = styled(RouterLink)`
  color: var(--ui-primary);
  font-weight: 500;
  text-decoration: none;

  &:hover {
    color: var(--ui-primary);
    text-decoration: underline;
  }
`

export const SC_MailButton = styled.button`
  padding: 0;
  border: none;
  font: inherit;
  font-weight: 500;
  color: var(--ui-primary);
  background: none;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
`
