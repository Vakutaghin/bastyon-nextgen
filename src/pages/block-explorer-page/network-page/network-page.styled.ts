import styled from 'vue3-styled-components'
import { BREAKPOINTS, TRANSITIONS } from '@/styles/design-tokens'

export const SC_NetGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`

export const SC_NetTwoCols = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 20px;

  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    grid-template-columns: 1fr;
  }
`

export const SC_NetCountries = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(240px, 1fr);
  gap: 20px;
  padding: 16px 20px 20px;

  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    grid-template-columns: 1fr;
    padding: 12px 14px 16px;
  }
`

export const SC_NetCardBody = styled.div`
  padding: 16px 20px 20px;

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    padding: 12px 14px 16px;
  }
`

export const SC_NetCardTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`

export const SC_NetCardLead = styled.p`
  margin: 0 0 14px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--ui-text-muted);
`

// --- Сводка сверху

export const SC_NetStats = styled.div`
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: ${() => BREAKPOINTS.DESKTOP}) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`

// --- Обход сети

export const SC_NetCrawl = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--ui-border);
`

export const SC_NetCrawlText = styled.div`
  flex: 1;
  min-width: 220px;
  font-size: 13px;
  color: var(--ui-text-muted);

  & strong {
    color: var(--ui-text-highlighted);
    font-weight: 600;
  }
`

export const SC_NetButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border: 1px solid transparent;
  border-radius: var(--ui-radius-md);
  background: var(--ui-primary);
  color: var(--ui-bg);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity ${() => TRANSITIONS.QUICK};

  &:hover:not(:disabled) {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }

  &.secondary {
    background: var(--ui-bg);
    color: var(--ui-text-highlighted);
    border-color: var(--ui-border);
  }
`

export const SC_NetProgress = styled('div', { share: Number })`
  flex-basis: 100%;
  height: 4px;
  border-radius: var(--ui-radius-xs);
  background: var(--ui-bg-elevated);
  overflow: hidden;

  &::after {
    content: '';
    display: block;
    width: ${(p) => Math.round((p.share ?? 0) * 100)}%;
    height: 100%;
    background: var(--ui-primary);
    transition: width ${() => TRANSITIONS.FAST};
  }
`

export const SC_NetEmpty = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  text-align: center;
  background: var(--ui-bg);

  & h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--ui-text-highlighted);
  }

  & p {
    max-width: 460px;
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--ui-text-muted);
  }
`

// --- Списки с долей

export const SC_ShareList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const SC_ShareRow = styled.li`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 10px;
  padding: 6px 8px;
  border-radius: var(--ui-radius-md);
  font-size: 13px;
  color: var(--ui-text-highlighted);

  &.clickable {
    cursor: pointer;
  }

  &.clickable:hover,
  &.active {
    background: var(--ui-bg-elevated);
  }
`

export const SC_ShareName = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  & small {
    margin-left: 6px;
    color: var(--ui-text-dimmed);
  }
`

export const SC_ShareCount = styled.span`
  color: var(--ui-text-muted);
  font-variant-numeric: tabular-nums;
`

export const SC_ShareBar = styled('span', { share: Number, color: String })`
  grid-column: 1 / -1;
  height: 4px;
  border-radius: var(--ui-radius-xs);
  background: var(--ui-bg-elevated);
  overflow: hidden;

  &::after {
    content: '';
    display: block;
    width: ${(p) => Math.max(1, Math.round((p.share ?? 0) * 100))}%;
    height: 100%;
    background: ${(p) => p.color || 'var(--ui-primary)'};
  }
`

export const SC_ShareMore = styled.button`
  align-self: flex-start;
  margin-top: 6px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ui-primary-text);
  font-size: 13px;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
`

export const SC_SubTitle = styled.h3`
  display: flex;
  align-items: center;
  margin: 18px 0 8px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--ui-text-muted);

  &:first-child {
    margin-top: 0;
  }
`

// --- Путь «вы → прокси → нода»

export const SC_Path = styled.ol`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin: 0 0 16px;
  padding: 0;
  list-style: none;

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    grid-template-columns: 1fr;
  }
`

export const SC_PathStep = styled.li`
  position: relative;
  padding: 10px 12px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-md);
  font-size: 13px;

  & b {
    display: flex;
    align-items: center;
    margin-bottom: 2px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--ui-text-muted);
  }

  & span {
    display: block;
    color: var(--ui-text-highlighted);
    overflow-wrap: anywhere;
  }

  & small {
    display: block;
    margin-top: 2px;
    color: var(--ui-text-dimmed);
  }

  &.live span {
    color: var(--ui-primary);
  }
`

export const SC_ProxyRow = styled.li`
  display: grid;
  grid-template-columns: 12px minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--ui-border);
  font-size: 13px;

  &:last-child {
    border-bottom: 0;
  }

  & small {
    grid-column: 2 / -1;
    color: var(--ui-text-dimmed);
  }
`

export const SC_Dot = styled('span', { color: String })`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${(p) => p.color ?? ''};
`

export const SC_ProxyName = styled.span`
  color: var(--ui-text-highlighted);
  font-weight: 500;

  & em {
    margin-left: 6px;
    font-style: normal;
    font-size: 11px;
    color: var(--ui-primary);
  }
`

export const SC_ProxyMeta = styled.span`
  color: var(--ui-text-muted);
  font-variant-numeric: tabular-nums;
  text-align: right;
`

export const SC_PinList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`

export const SC_PinOption = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-md);
  font-size: 13px;
  cursor: pointer;

  &.active {
    border-color: var(--ui-primary);
    color: var(--ui-primary);
  }

  & input {
    margin: 0;
  }
`

// --- Таблица нод

export const SC_TableTools = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--ui-border);
`

export const SC_TableSearch = styled.input`
  flex: 1;
  min-width: 200px;
  padding: 7px 10px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-md);
  background: var(--ui-bg);
  color: var(--ui-text-highlighted);
  font-size: 14px;

  &:focus {
    outline: 2px solid var(--ui-primary);
    outline-offset: -1px;
  }
`

export const SC_Chip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-full);
  background: var(--ui-bg);
  color: var(--ui-text-highlighted);
  font-size: 13px;
  cursor: pointer;

  &.active {
    border-color: var(--ui-primary);
    color: var(--ui-primary);
  }
`

export const SC_TableScroll = styled.div`
  overflow-x: auto;
`

export const SC_Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;

  & th {
    position: sticky;
    top: 0;
    padding: 8px 12px;
    background: var(--ui-bg);
    border-bottom: 1px solid var(--ui-border);
    color: var(--ui-text-muted);
    font-size: 12px;
    font-weight: 500;
    text-align: left;
    white-space: nowrap;
  }

  & th button {
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  & th button:hover,
  & th.sorted button {
    color: var(--ui-text-highlighted);
  }

  & td {
    padding: 8px 12px;
    border-bottom: 1px solid var(--ui-border);
    color: var(--ui-text-highlighted);
    white-space: nowrap;
  }

  & tr.clickable {
    cursor: pointer;
  }

  & tr.clickable:hover td,
  & tr.active td {
    background: var(--ui-bg-elevated);
  }

  & td.num,
  & th.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  & td.mono {
    font-family: var(--font-mono, ui-monospace, monospace);
  }

  & td.muted {
    color: var(--ui-text-muted);
  }

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    & .hide-mobile {
      display: none;
    }
  }
`

export const SC_Tag = styled('span', { color: String })`
  display: inline-flex;
  align-items: center;
  gap: 5px;

  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${(p) => p.color ?? ''};
  }
`

export const SC_TableFooter = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 20px;
  font-size: 13px;
  color: var(--ui-text-muted);
`

export const SC_Sources = styled.p`
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--ui-text-dimmed);

  & a {
    color: inherit;
  }
`
