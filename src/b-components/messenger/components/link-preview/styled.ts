import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_LinkPreview = styled.a`
  display: flex;
  text-decoration: none;
  border-left: 3px solid ${COLORS.BRAND_CYAN};
  background: ${COLORS.BRAND_CYAN_SOFT};
  border-radius: 0 8px 8px 0;
  padding: 8px 10px;
  margin-top: 4px;
  width: 100%;
  max-width: min(320px, 100%);
  box-sizing: border-box;
  color: ${COLORS.TEXT_PRIMARY};
  gap: 10px;
  align-items: flex-start;
  cursor: pointer;
  overflow: hidden;

  &:hover {
    background: ${COLORS.BRAND_CYAN_LIGHT};
  }
`

export const SC_Body = styled.div`
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`

export const SC_SiteName = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: ${COLORS.BRAND_CYAN};
  text-transform: uppercase;
  letter-spacing: 0.3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SC_Title = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${COLORS.TEXT_PRIMARY};
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`

export const SC_Description = styled.div`
  font-size: 12px;
  color: ${COLORS.TEXT_DARK};
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
`

export const SC_Thumb = styled.img`
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: 6px;
  flex-shrink: 0;
  background: ${COLORS.BG_SECONDARY};
`
