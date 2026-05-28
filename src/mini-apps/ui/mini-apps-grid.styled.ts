import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'
import { COLORS } from '@/styles/theme-colors'

export const SC_Search = styled.div`
  margin: 8px 0 16px;
`

export const SC_Section = styled.section`
  margin: 0 0 24px;
`

export const SC_SectionTitle = styled.h2`
  font-size: 14px;
  font-weight: 600;
  color: ${COLORS.OVERLAY_70};
  margin: 0 0 12px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
`

export const SC_Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 12px;
  }
`

export const SC_Card = styled.button`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  padding: 20px 12px 16px;
  border: 1px solid ${COLORS.OVERLAY_8};
  border-radius: 14px;
  background: ${COLORS.WHITE};
  cursor: pointer;
  transition:
    transform 120ms ease,
    box-shadow 120ms ease,
    border-color 120ms ease;
  text-align: center;
  font: inherit;
  color: ${COLORS.GRAY_212};

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 14px ${COLORS.OVERLAY_6};
    border-color: ${COLORS.OVERLAY_12};
  }

  &:active {
    transform: translateY(0);
  }
`

export const SC_FavoriteBtn = styled.button`
  position: absolute;
  top: 6px;
  right: 6px;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  color: ${COLORS.OVERLAY_25};
  font-size: 14px;
  transition:
    color 150ms ease,
    background-color 150ms ease;

  &:hover {
    background: ${COLORS.OVERLAY_5};
    color: ${COLORS.WARNING_YELLOW};
  }

  &.active {
    color: ${COLORS.WARNING_YELLOW};
  }
`

export const SC_IconWrap = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${COLORS.OVERLAY_4};
  flex: 0 0 auto;
`

export const SC_Icon = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`

export const SC_IconFallback = styled.div`
  font-size: 22px;
  font-weight: 600;
  color: ${COLORS.OVERLAY_55};
`

export const SC_Name = styled.div`
  font-size: 13px;
  font-weight: 500;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
`

export const SC_LoadMore = styled.div`
  display: flex;
  justify-content: center;
  margin: 20px 0;
`

export const SC_LoadMoreBtn = styled.button`
  padding: 8px 20px;
  border: 1px solid ${COLORS.OVERLAY_12};
  background: ${COLORS.WHITE};
  border-radius: 8px;
  font-size: 13px;
  color: ${COLORS.GRAY_212};
  cursor: pointer;
  transition: background-color 120ms ease;

  &:hover {
    background: ${COLORS.OVERLAY_4};
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`

export const SC_Empty = styled.div`
  padding: 40px 16px;
  text-align: center;
  color: ${COLORS.OVERLAY_55};
  font-size: 14px;
`

export const SC_Error = styled.div`
  padding: 16px;
  border-radius: 8px;
  background: ${COLORS.DANGER_BG_SOFT};
  color: ${COLORS.DANGER_DEEP};
  font-size: 13px;
  margin: 12px 0;
`
