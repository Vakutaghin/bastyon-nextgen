import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { Z_INDEX, TRANSITIONS } from '@/styles/design-tokens'

export const SC_ExplorerSearch = styled.form`
  position: relative;
  display: flex;
  align-items: stretch;
  width: 100%;
  max-width: 720px;
`

export const SC_ExplorerSearchInput = styled.input`
  flex: 1;
  height: 40px;
  padding: 0 110px 0 12px;
  font-size: 14px;
  line-height: 1.2;
  color: var(--ui-text-highlighted);
  background: var(--ui-bg);
  border: 1px solid var(--ui-border-accented);
  border-radius: var(--ui-radius-md);
  outline: none;
  transition:
    border-color ${TRANSITIONS.QUICK},
    box-shadow ${TRANSITIONS.QUICK};

  &::placeholder {
    color: var(--ui-text-dimmed);
  }

  &:focus {
    border-color: var(--ui-primary);
    box-shadow: 0 0 0 3px rgb(var(--ui-primary-rgb) / 25%);
  }
`

export const SC_ExplorerSearchHint = styled.span`
  position: absolute;
  right: 96px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 11px;
  color: var(--color-text-muted);
  letter-spacing: 0.5px;
  text-transform: uppercase;
  pointer-events: none;
`

export const SC_ExplorerSearchButton = styled.button`
  position: absolute;
  right: 4px;
  top: 4px;
  bottom: 4px;
  padding: 0 10px;
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-text-inverted);
  background: var(--ui-primary);
  border: none;
  border-radius: var(--ui-radius-sm);
  cursor: pointer;
  transition: background-color ${TRANSITIONS.QUICK};

  &:hover {
    background: rgb(var(--ui-primary-rgb) / 75%);
    color: var(--ui-text-inverted);
  }

  &:disabled {
    background: var(--ui-primary);
    color: var(--ui-text-inverted);
    opacity: 0.75;
    cursor: not-allowed;
  }
`

export const SC_ExplorerSearchError = styled.div`
  margin-top: 8px;
  font-size: 12px;
  color: var(--color-danger);
`

export const SC_SuggestionsDropdown = styled.div`
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: ${Z_INDEX.LOCAL_DROPDOWN_HIGH};
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-lighter);
  border-radius: var(--ui-radius-lg);
  box-shadow: 0 8px 24px var(--color-overlay-8);
  overflow: hidden;
`

export const SC_SuggestionsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--ui-border);
`

export const SC_ClearAllBtn = styled.button`
  background: transparent;
  border: none;
  font-size: 11px;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 2px 4px;

  &:hover {
    color: var(--color-danger);
  }
`

const itemAttrs = { highlighted: Boolean }
export const SC_SuggestionItem = styled('button', itemAttrs)`
  display: grid;
  grid-template-columns: 70px minmax(0, 1fr) 70px 22px;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 14px;
  background: ${(p) => (p.highlighted ? COLORS.BG_HOVER_BLUE : COLORS.BG_PRIMARY)};
  border: none;
  border-bottom: 1px solid var(--color-border-lighter);
  cursor: pointer;
  text-align: left;
  transition: background-color ${TRANSITIONS.QUICK};

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: var(--color-bg-hover-blue);
  }
`

const badgeAttrs = { kind: String }
export const SC_KindBadge = styled('span', badgeAttrs)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 600;
  border-radius: var(--ui-radius-sm);
  white-space: nowrap;
  color: ${(p) => {
    if (p.kind === 'tx') return COLORS.SUCCESS
    if (p.kind === 'address') return COLORS.WARNING_HEX
    return COLORS.PRIMARY
  }};
  background: ${(p) => {
    if (p.kind === 'tx') return COLORS.SUCCESS_BG_12
    if (p.kind === 'address') return COLORS.WARNING_BG_SOFT
    return COLORS.PRIMARY_LIGHT
  }};
`

export const SC_SuggestionValue = styled.span`
  font-family: var(--font-family-mono);
  font-size: 13px;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const SC_SuggestionAge = styled.span`
  font-size: 11px;
  color: var(--color-text-muted);
  text-align: right;
  font-variant-numeric: tabular-nums;
`

export const SC_RemoveItemBtn = styled.button`
  appearance: none;
  border: none;
  padding: 0;
  background: transparent;
  font: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: var(--ui-radius-sm);
  color: var(--color-text-muted);
  cursor: pointer;
  transition:
    color ${TRANSITIONS.QUICK},
    background-color ${TRANSITIONS.QUICK};

  &:hover {
    color: var(--color-danger);
    background: var(--color-overlay-5);
  }
`

export const SC_SearchWrapper = styled.div`
  position: relative;
  width: 100%;
  max-width: 720px;
`
