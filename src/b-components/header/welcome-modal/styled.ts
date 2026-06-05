import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
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
  color: ${COLORS.PRIMARY};
  line-height: 1;
`

export const SC_WelcomeTitle = styled.h2`
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: ${COLORS.TEXT_PRIMARY};
`

export const SC_WelcomeDesc = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: ${COLORS.TEXT_SECONDARY};
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
  background: ${COLORS.BORDER_DEFAULT};
  transition: background ${TRANSITIONS.FAST};

  &.active {
    background: ${COLORS.PRIMARY};
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
  color: ${COLORS.TEXT_MUTED};
  font-size: 13px;
  cursor: pointer;
  padding: 6px 4px;

  &:hover {
    color: ${COLORS.TEXT_SECONDARY};
  }
`

export const SC_WelcomeNav = styled.div`
  display: flex;
  gap: 8px;
`

export const SC_WelcomeBack = styled.button`
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid ${COLORS.BORDER_DEFAULT};
  background: ${COLORS.BG_SECONDARY};
  color: ${COLORS.TEXT_PRIMARY};
  font-size: 14px;
  cursor: pointer;
  transition: background ${TRANSITIONS.FAST};

  &:hover {
    background: ${COLORS.BG_HOVER};
  }
`

export const SC_WelcomeNext = styled.button`
  padding: 8px 20px;
  border-radius: 8px;
  border: none;
  background: ${COLORS.PRIMARY};
  color: ${COLORS.WHITE};
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background ${TRANSITIONS.FAST};

  &:hover {
    background: ${COLORS.PRIMARY_HOVER};
  }
`
