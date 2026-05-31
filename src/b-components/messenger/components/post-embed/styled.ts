import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_PostEmbed = styled.div`
  display: flex;
  flex-direction: column;
  border: 1px solid ${COLORS.BORDER};
  border-radius: 10px;
  background: ${COLORS.BG_PRIMARY};
  width: 100%;
  max-width: min(320px, 100%);
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.15s ease;

  &:hover {
    border-color: ${COLORS.BRAND_CYAN};
  }
`

export const SC_Header = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px 6px;
  min-width: 0;
`

export const SC_Avatar = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: ${COLORS.BG_TERTIARY};
  flex-shrink: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${COLORS.WHITE};
  font-weight: 600;
  font-size: 12px;
`

export const SC_AvatarImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`

export const SC_HeaderInfo = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1 1 auto;
`

export const SC_AuthorName = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${COLORS.TEXT_PRIMARY};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SC_AuthorMeta = styled.div`
  font-size: 11px;
  color: ${COLORS.BLUE_GRAY};
`

export const SC_BadgeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: ${COLORS.BLUE_GRAY};
`

export const SC_Body = styled.div`
  padding: 4px 12px 10px;
`

export const SC_Title = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: ${COLORS.TEXT_PRIMARY};
  line-height: 1.3;
  margin-bottom: 4px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`

export const SC_Snippet = styled.div`
  font-size: 13px;
  color: ${COLORS.TEXT_DARK};
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: pre-wrap;
  word-break: break-word;
`

export const SC_Thumb = styled('div', { aspect: String })`
  width: 100%;
  aspect-ratio: ${(p: any) => p.aspect || '16 / 9'};
  background: ${COLORS.BG_SECONDARY};
  position: relative;
  overflow: hidden;
`

export const SC_ThumbImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`

export const SC_VideoBadge = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
`

export const SC_VideoIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: ${COLORS.OVERLAY_55};
  display: flex;
  align-items: center;
  justify-content: center;

  &::before {
    content: '';
    width: 0;
    height: 0;
    border-left: 14px solid ${COLORS.WHITE};
    border-top: 9px solid transparent;
    border-bottom: 9px solid transparent;
    margin-left: 4px;
  }
`

export const SC_Loading = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  color: ${COLORS.BLUE_GRAY};
  font-size: 13px;
`

export const SC_Spinner = styled.div`
  width: 18px;
  height: 18px;
  border: 2px solid ${COLORS.BG_TERTIARY};
  border-top-color: ${COLORS.BRAND_CYAN};
  border-radius: 50%;
  animation: spin 1s linear infinite; /* @keyframes spin — глобально в style.css */
`

export const SC_FailedHint = styled.a`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  text-decoration: none;
  color: ${COLORS.BRAND_CYAN};
  font-size: 13px;
  border: 1px solid ${COLORS.BORDER};
  border-radius: 10px;
  background: ${COLORS.BG_PRIMARY};
  width: 100%;
  max-width: min(320px, 100%);
  box-sizing: border-box;

  &:hover {
    background: ${COLORS.BG_HOVER_BLUE};
  }
`
