import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { TRANSITIONS } from '@/styles/design-tokens'

export const SC_Embed = styled.article`
  max-width: 680px;
  margin: 0 auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: ${COLORS.TEXT_PRIMARY};
  background: ${COLORS.BG_PRIMARY};
`

export const SC_EmbedHeader = styled.a`
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: inherit;
`

export const SC_EmbedAvatar = styled.span`
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 50%;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: ${COLORS.BG_SECONDARY};
  color: ${COLORS.TEXT_SECONDARY};
  font-weight: 600;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

export const SC_EmbedAuthor = styled.span`
  font-size: 15px;
  font-weight: 600;
  color: ${COLORS.TEXT_PRIMARY};
`

export const SC_EmbedTime = styled.span`
  font-size: 12px;
  color: ${COLORS.TEXT_MUTED};
`

export const SC_EmbedTitle = styled.h1`
  margin: 0;
  font-size: 19px;
  font-weight: 700;
`

export const SC_EmbedMedia = styled.div`
  width: 100%;
`

export const SC_EmbedFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid ${COLORS.BORDER_LIGHTER};
  padding-top: 12px;
`

export const SC_EmbedCta = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 8px;
  background: ${COLORS.PRIMARY};
  color: ${COLORS.WHITE};
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  transition: background ${TRANSITIONS.FAST};

  &:hover {
    background: ${COLORS.PRIMARY_HOVER};
  }
`

export const SC_EmbedState = styled.div`
  max-width: 680px;
  margin: 0 auto;
  padding: 48px 16px;
  text-align: center;
  font-size: 15px;
  color: ${COLORS.TEXT_SECONDARY};
`
