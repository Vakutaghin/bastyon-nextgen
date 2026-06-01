import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { BREAKPOINTS } from '@/styles/design-tokens'
import { SC_Placeholder as SC_PlaceholderBase } from '../components/shared/explorer-primitives.styled'

export const SC_PeersWork = styled.div`
  display: flex;
  flex: 1;
  width: 100%;
  background: ${COLORS.BG_PRIMARY};
`

export const SC_PeersPage = styled.main`
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 88px 24px 48px;
`

export const SC_PeersBreadcrumb = styled.div`
  margin-bottom: 12px;
  font-size: 13px;
  color: ${COLORS.TEXT_MUTED};

  a {
    color: ${COLORS.LINK};
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
`

export const SC_PeersTitle = styled.h1`
  font-size: 24px;
  font-weight: 700;
  color: ${COLORS.TEXT_PRIMARY};
  margin: 0 0 24px;
`

export const SC_PeersSection = styled.section`
  background: ${COLORS.BG_PRIMARY};
  border: 1px solid ${COLORS.BORDER_LIGHTER};
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 24px;
`

export const SC_PeersSectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid ${COLORS.BORDER_LIGHTER};
`

export const SC_PeersSectionTitle = styled.h2`
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: ${COLORS.TEXT_PRIMARY};
  margin: 0;
`

export const SC_PeersSectionHint = styled.div`
  font-size: 12px;
  color: ${COLORS.TEXT_SECONDARY};
`

export const SC_NodeRow = styled.div`
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) 90px 90px 90px;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  border-bottom: 1px solid ${COLORS.BORDER_LIGHTER};
  font-size: 13px;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: ${COLORS.OVERLAY_3};
  }

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    grid-template-columns: 22px minmax(0, 1fr) 80px;

    & > .secondary {
      display: none;
    }
  }
`

const dotProps = { color: String }
export const SC_NodeDot = styled('span', dotProps)`
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${(p) => p.color};
  box-shadow: 0 0 0 3px ${(p) => p.color}33;
`

export const SC_NodeAddr = styled.div`
  font-family: 'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  color: ${COLORS.TEXT_PRIMARY};
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const SC_NodeMetric = styled.div`
  font-size: 12px;
  color: ${COLORS.TEXT_SECONDARY};
  font-variant-numeric: tabular-nums;
  text-align: right;
`

export const SC_NodeMetricLabel = styled.span`
  display: block;
  font-size: 10px;
  color: ${COLORS.TEXT_MUTED};
  text-transform: uppercase;
  letter-spacing: 0.4px;
`

export const SC_PeerTableHeader = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) 1fr 70px 70px 90px 70px;
  gap: 10px;
  padding: 10px 18px;
  background: ${COLORS.BG_SECONDARY};
  border-bottom: 1px solid ${COLORS.BORDER_LIGHTER};
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: ${COLORS.TEXT_SECONDARY};

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    grid-template-columns: minmax(0, 1.4fr) 1fr 80px;

    & > .col-hide-mobile {
      display: none;
    }
  }
`

export const SC_PeerRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) 1fr 70px 70px 90px 70px;
  align-items: center;
  gap: 10px;
  padding: 10px 18px;
  border-bottom: 1px solid ${COLORS.BORDER_LIGHTER};
  font-size: 13px;
  font-variant-numeric: tabular-nums;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: ${COLORS.OVERLAY_3};
  }

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    grid-template-columns: minmax(0, 1.4fr) 1fr 80px;

    & > .col-hide-mobile {
      display: none;
    }
  }
`

export const SC_PeerAddr = styled.div`
  font-family: 'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: ${COLORS.TEXT_PRIMARY};
`

export const SC_PeerVersion = styled.div`
  font-size: 12px;
  color: ${COLORS.TEXT_SECONDARY};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const SC_DirectionBadge = styled('span', { dir: String })`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
  white-space: nowrap;
  color: ${(p) => (p.dir === 'in' ? COLORS.SUCCESS : COLORS.PRIMARY)};
  background: ${(p) => (p.dir === 'in' ? COLORS.SUCCESS_BG_TINT : COLORS.PRIMARY_LIGHT)};
`

// Общий плейсхолдер (audit §3.1) + мелкий шрифт страницы пиров.
export const SC_Placeholder = styled(SC_PlaceholderBase)`
  font-size: 13px;
`

export const SC_PlaceholderError = styled(SC_Placeholder)`
  color: ${COLORS.DANGER};
`
