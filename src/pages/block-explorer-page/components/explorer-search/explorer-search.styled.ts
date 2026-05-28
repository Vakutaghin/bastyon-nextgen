import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_ExplorerSearch = styled.form`
  position: relative;
  display: flex;
  align-items: stretch;
  width: 100%;
  max-width: 720px;
`

export const SC_ExplorerSearchInput = styled.input`
  flex: 1;
  height: 44px;
  padding: 0 110px 0 16px;
  font-size: 14px;
  line-height: 1.2;
  color: ${COLORS.TEXT_PRIMARY};
  background: ${COLORS.BG_PRIMARY};
  border: 1px solid ${COLORS.BORDER};
  border-radius: 8px;
  outline: none;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;

  &::placeholder {
    color: ${COLORS.TEXT_MUTED};
  }

  &:hover {
    border-color: ${COLORS.PRIMARY_LIGHT_50};
  }

  &:focus {
    border-color: ${COLORS.PRIMARY};
    box-shadow: 0 0 0 3px ${COLORS.PRIMARY_LIGHT_15};
  }
`

export const SC_ExplorerSearchHint = styled.span`
  position: absolute;
  right: 96px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 11px;
  color: ${COLORS.TEXT_MUTED};
  letter-spacing: 0.5px;
  text-transform: uppercase;
  pointer-events: none;
`

export const SC_ExplorerSearchButton = styled.button`
  position: absolute;
  right: 4px;
  top: 4px;
  bottom: 4px;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 600;
  color: ${COLORS.WHITE};
  background: ${COLORS.PRIMARY};
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover {
    background: ${COLORS.PRIMARY_HOVER};
  }

  &:disabled {
    background: ${COLORS.BG_DISABLED};
    color: ${COLORS.TEXT_MUTED};
    cursor: not-allowed;
  }
`

export const SC_ExplorerSearchError = styled.div`
  margin-top: 8px;
  font-size: 12px;
  color: ${COLORS.DANGER};
`

export const SC_SuggestionsDropdown = styled.div`
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 100;
  background: ${COLORS.BG_PRIMARY};
  border: 1px solid ${COLORS.BORDER_LIGHTER};
  border-radius: 8px;
  box-shadow: 0 8px 24px ${COLORS.OVERLAY_8};
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
  color: ${COLORS.TEXT_SECONDARY};
  background: ${COLORS.BG_SECONDARY};
  border-bottom: 1px solid ${COLORS.BORDER_LIGHTER};
`

export const SC_ClearAllBtn = styled.button`
  background: transparent;
  border: none;
  font-size: 11px;
  color: ${COLORS.TEXT_MUTED};
  cursor: pointer;
  padding: 2px 4px;

  &:hover {
    color: ${COLORS.DANGER};
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
  border-bottom: 1px solid ${COLORS.BORDER_LIGHTER};
  cursor: pointer;
  text-align: left;
  transition: background-color 0.1s ease;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: ${COLORS.BG_HOVER_BLUE};
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
  border-radius: 4px;
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
  font-family: 'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  color: ${COLORS.TEXT_PRIMARY};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const SC_SuggestionAge = styled.span`
  font-size: 11px;
  color: ${COLORS.TEXT_MUTED};
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
  border-radius: 4px;
  color: ${COLORS.TEXT_MUTED};
  cursor: pointer;
  transition:
    color 0.1s ease,
    background-color 0.1s ease;

  &:hover {
    color: ${COLORS.DANGER};
    background: ${COLORS.OVERLAY_5};
  }
`

export const SC_SearchWrapper = styled.div`
  position: relative;
  width: 100%;
  max-width: 720px;
`
