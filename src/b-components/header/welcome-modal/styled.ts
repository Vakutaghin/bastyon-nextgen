import styled from 'vue3-styled-components'
import { TRANSITIONS } from '@/styles/design-tokens'

export const SC_Welcome = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 12px 8px 4px;
  gap: 14px;
`

export const SC_WelcomeIcon = styled.div`
  font-size: 44px;
  color: var(--color-primary);
  line-height: 1;
`

export const SC_WelcomeTitle = styled.h2`
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text-primary);
`

export const SC_WelcomeDesc = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-text-secondary);
  max-width: 360px;
`

export const SC_WelcomeDots = styled.div`
  display: flex;
  gap: 7px;
  margin-top: 4px;
`

export const SC_WelcomeDot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-border-default);
  transition: background ${TRANSITIONS.FAST};

  &.active {
    background: var(--color-primary);
  }
`

export const SC_WelcomeActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 8px;
`

export const SC_WelcomeSkip = styled.button`
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 13px;
  cursor: pointer;
  padding: 6px 4px;

  &:hover {
    color: var(--color-text-secondary);
  }
`

export const SC_WelcomeNav = styled.div`
  display: flex;
  gap: 8px;
`

export const SC_WelcomeBack = styled.button`
  padding: 8px 16px;
  border-radius: var(--ui-radius-lg);
  border: 1px solid var(--color-border-default);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: background ${TRANSITIONS.FAST};

  &:hover {
    background: var(--color-bg-hover);
  }
`

export const SC_WelcomeNext = styled.button`
  padding: 8px 20px;
  border-radius: var(--ui-radius-lg);
  border: none;
  background: var(--color-primary);
  color: var(--color-white);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background ${TRANSITIONS.FAST};

  &:hover {
    background: var(--color-primary-hover);
  }
`
