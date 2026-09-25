import styled from 'vue3-styled-components'

export const SC_InfoPage = styled.div`
  max-width: 760px;
  margin: 0 auto;
  padding: 24px 16px 64px;
  width: 100%;
`

export const SC_InfoTitle = styled.h1`
  margin: 0 0 8px;
  font-size: 26px;
  font-weight: 700;
  color: var(--ui-text-highlighted);
`

export const SC_InfoLead = styled.p`
  margin: 0 0 20px;
  font-size: 16px;
  color: var(--color-text-secondary);
`

export const SC_InfoNote = styled.div`
  margin: 0 0 24px;
  padding: 10px 14px;
  border-radius: var(--ui-radius-lg);
  background: var(--color-warning-bg-soft);
  border: 1px solid var(--color-warning);
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.5;
`

export const SC_InfoSection = styled.section`
  margin: 0 0 22px;
`

export const SC_InfoHeading = styled.h2`
  margin: 0 0 8px;
  font-size: 17px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_InfoParagraph = styled.p`
  margin: 0 0 10px;
  font-size: 15px;
  line-height: 1.65;
  color: var(--color-text-primary);
`

export const SC_InfoNotFound = styled.div`
  padding: 48px 0;
  text-align: center;
  font-size: 16px;
  color: var(--color-text-secondary);
`

export const SC_InfoBack = styled.button`
  margin-top: 16px;
  padding: 6px 12px;
  border: 0;
  box-shadow: inset 0 0 0 1px var(--ui-border-accented);
  border-radius: var(--ui-radius-md);
  background: var(--ui-bg);
  color: var(--ui-text);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;

  &:hover {
    background: var(--ui-bg-elevated);
    color: var(--ui-text);
  }
`
