import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'
import { SC_Placeholder as SC_PlaceholderBase } from '../components/shared/explorer-primitives.styled'

export const SC_PeersWork = styled.div`
  display: flex;
  flex: 1;
  width: 100%;
  background: var(--color-bg-primary);
`

export const SC_PeersPage = styled.main`
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: calc(var(--header-height-total) + 28px) 24px 48px;
`

export const SC_PeersBreadcrumb = styled.div`
  margin-bottom: 12px;
  font-size: 14px;
  color: var(--color-text-muted);

  a {
    color: var(--color-link);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
`

export const SC_PeersTitle = styled.h1`
  font-size: 24px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  margin: 0 0 24px;
`

export const SC_PeersSection = styled.section`
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-lighter);
  border-radius: var(--ui-radius-lg);
  overflow: hidden;
  margin-bottom: 24px;
`

export const SC_PeersSectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--color-border-lighter);
`

export const SC_PeersSectionTitle = styled.h2`
  font-size: 16px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  margin: 0;
`

export const SC_PeersSectionHint = styled.div`
  font-size: 12px;
  color: var(--color-text-secondary);
`

export const SC_NodeRow = styled.div`
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) 90px 90px 90px;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  border-bottom: 1px solid var(--color-border-lighter);
  font-size: 14px;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: var(--color-overlay-3);
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
  position: relative;
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${(p) => p.color};

  /* Ореол тем же цветом. Цвет приходит токеном var(--ui-*), поэтому
     прозрачность — через opacity, а не приписанной к цвету hex-альфой. */
  &::after {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    background: ${(p) => p.color};
    opacity: 0.2;
  }
`

export const SC_NodeAddr = styled.div`
  font-family: var(--font-family-mono);
  color: var(--color-text-primary);
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const SC_NodeMetric = styled.div`
  font-size: 12px;
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
  text-align: right;
`

export const SC_NodeMetricLabel = styled.span`
  display: block;
  font-size: 12px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.4px;
`

export const SC_PeerTableHeader = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) 1fr 90px 90px 100px 110px;
  gap: 10px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--ui-border);
  /* Шапка таблицы как у UTable: 14px/600, цвет заголовков, без капса. */
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-text-highlighted);

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    grid-template-columns: minmax(0, 1.4fr) 1fr 80px;

    & > .col-hide-mobile {
      display: none;
    }
  }
`

export const SC_PeerRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) 1fr 90px 90px 100px 110px;
  align-items: center;
  gap: 10px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--color-border-lighter);
  font-size: 14px;
  font-variant-numeric: tabular-nums;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: var(--color-overlay-3);
  }

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    grid-template-columns: minmax(0, 1.4fr) 1fr 80px;

    & > .col-hide-mobile {
      display: none;
    }
  }
`

export const SC_PeerAddr = styled.div`
  font-family: var(--font-family-mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--color-text-primary);
`

export const SC_PeerVersion = styled.div`
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const SC_DirectionBadge = styled('span', { dir: String })`
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  font-size: 12px;
  font-weight: 500;
  border-radius: var(--ui-radius-md);
  white-space: nowrap;
  color: ${(p) => (p.dir === 'in' ? 'var(--ui-info)' : 'var(--ui-primary)')};
  background: ${(p) =>
    p.dir === 'in' ? 'rgb(var(--ui-info-rgb) / 10%)' : 'rgb(var(--ui-primary-rgb) / 10%)'};
`

// Общий плейсхолдер (audit §3.1) + мелкий шрифт страницы пиров.
export const SC_Placeholder = styled(SC_PlaceholderBase)`
  font-size: 14px;
`

export const SC_PlaceholderError = styled(SC_Placeholder)`
  color: var(--color-danger);
`

/**
 * Второстепенная ячейка таблицы пиров (ping/sync/возраст).
 * Цвета — CSS-переменными, как в `COLORS`: интерполяция токена в новый
 * styled-файл добавляет TS2345 в типах vue3-styled-components.
 */
export const SC_PeerMetaCell = styled.div`
  font-size: 12px;
  color: var(--color-text-secondary);
`

/** Прочерк «нет данных» в карточке ноды. */
export const SC_NodeMetricEmpty = styled.span`
  color: var(--color-danger);
`
