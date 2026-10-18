import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  height: 100%;
  flex-shrink: 0;

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    gap: 5px;
  }

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    margin-right: 20px;
  }
`

export const SC_LogoLink = styled.button`
  display: flex;
  align-items: center;
  height: 40px;
  background: none;
  border: none;
  padding: 0;
  transition: opacity var(--transition-normal);
  cursor: pointer;

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    width: 31px;
    overflow: hidden;
  }

  &:hover {
    opacity: 0.8;
  }

  &:focus {
    border-radius: var(--ui-radius-sm);
  }
`

export const SC_LogoImg = styled.img`
  height: 32px;
  width: auto;
  object-fit: contain;
  display: block;
  pointer-events: none;
  user-select: none;
`

export const SC_LogoLang = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  padding: 0;
  cursor: pointer;
  border-radius: var(--ui-radius-md);
  transition: background-color var(--transition-quick);
  background: transparent;
  border: 0;

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    display: none;
  }

  &:hover {
    background: var(--ui-bg-elevated);
  }
`

export const SC_LanguageFlag = styled.span`
  font-size: 20px;
  line-height: 1;
`
