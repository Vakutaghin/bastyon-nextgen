import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_HeaderSearchWrapper = styled.div`
  position: relative;

  /* Поиск — единственный эластичный элемент хедера: логотип и правый блок с
     иконками имеют собственную ширину и не сжимаются. Поэтому при нехватке
     места ужиматься должен именно инпут (базовые 45%, дальше по остатку), а не
     выдавливаться кнопки справа. min-width: 0 обязателен — иначе flex-элемент
     не сожмётся уже своей min-content ширины, которую задаёт сам <input>. */
  flex: 0 1 45%;
  min-width: 0;

  /* Чтобы InputSearch внутри занял всю ширину обёртки (он сам по себе тоже
     ставит width: 45%, что в нашей обёртке стало бы 20% от хедера). */
  & > :first-child {
    width: 100%;
  }

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    flex-basis: 100%;
  }
`

export const SC_Dropdown = styled.div`
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  background: var(--ui-bg);
  border-radius: var(--ui-radius-md);
  box-shadow:
    0 0 0 1px var(--ui-border),
    var(--ui-shadow-lg);
  z-index: 2000;
  max-height: 70vh;
  overflow-y: auto;
  padding: 4px;
`

export const SC_DropdownSection = styled.div`
  & + & {
    margin-top: 4px;
    padding-top: 4px;
    border-top: 1px solid var(--ui-border);
  }
`

export const SC_DropdownSectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_DropdownSeeAll = styled.button`
  background: none;
  border: none;
  padding: 2px 6px;
  border-radius: var(--ui-radius-sm);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  color: var(--ui-primary-text);

  &:hover {
    background: rgb(var(--ui-primary-rgb) / 10%);
  }
`

export const SC_DropdownItem = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 6px;
  border: none;
  background: none;
  border-radius: var(--ui-radius-md);
  cursor: pointer;
  text-align: left;
  color: var(--ui-text);
  font-size: 14px;

  &:hover {
    background: rgb(var(--ui-bg-elevated-rgb) / 50%);
    color: var(--ui-text-highlighted);
  }
`

export const SC_Avatar = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--ui-bg-elevated);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--ui-text-muted);
  font-weight: 500;
  font-size: 12px;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`

export const SC_ItemBody = styled.div`
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
`

export const SC_ItemPrimary = styled.div`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
`

export const SC_ItemSecondary = styled.div`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  color: var(--color-text-secondary);
`

export const SC_TagCount = styled.span`
  font-size: 11px;
  color: var(--color-text-hint);
  margin-left: 6px;
`

export const SC_EmptyHint = styled.div`
  padding: 12px;
  text-align: center;
  color: var(--color-text-hint);
  font-size: 12px;
`

export const SC_LoadingHint = styled.div`
  padding: 12px;
  text-align: center;
  color: var(--color-text-hint);
  font-size: 12px;
`

export const SC_RecentClearButton = styled.button`
  background: none;
  border: none;
  padding: 2px 6px;
  border-radius: var(--ui-radius-sm);
  cursor: pointer;
  font-size: 11px;
  color: var(--color-text-hint);
  text-transform: none;
  letter-spacing: 0;

  &:hover {
    background: var(--color-bg-hover-blue);
    color: var(--color-text-primary);
  }
`

export const SC_RecentRemoveButton = styled.button`
  background: none;
  border: none;
  padding: 4px;
  margin-left: auto;
  border-radius: var(--ui-radius-sm);
  cursor: pointer;
  color: var(--color-text-hint);
  font-size: 14px;
  line-height: 1;
  flex-shrink: 0;

  &:hover {
    background: var(--color-bg-hover-blue);
    color: var(--color-text-primary);
  }
`

export const SC_RecentIcon = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--color-gray-e8);
  color: var(--color-text-secondary);
  font-size: 14px;
  flex-shrink: 0;
`
