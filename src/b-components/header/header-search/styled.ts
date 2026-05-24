import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_HeaderSearchWrapper = styled.div`
  position: relative;
  width: 45%;
  flex-shrink: 0;

  /* Чтобы InputSearch внутри занял всю ширину обёртки (он сам по себе тоже
     ставит width: 45%, что в нашей обёртке стало бы 20% от хедера). */
  & > :first-child {
    width: 100%;
  }

  @media (max-width: 768px) {
    width: 100%;
    flex-shrink: 1;
  }
`

export const SC_Dropdown = styled.div`
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  background: ${COLORS.BG_PRIMARY};
  border: 1px solid ${COLORS.BORDER_LIGHT};
  border-radius: 12px;
  box-shadow: ${COLORS.SHADOW_LG};
  z-index: 2000;
  max-height: 70vh;
  overflow-y: auto;
  padding: 8px;
`

export const SC_DropdownSection = styled.div`
  & + & {
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid ${COLORS.BORDER_LIGHTER};
  }
`

export const SC_DropdownSectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: ${COLORS.TEXT_HINT};
`

export const SC_DropdownSeeAll = styled.button`
  background: none;
  border: none;
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  color: ${COLORS.PRIMARY};
  text-transform: none;
  letter-spacing: 0;

  &:hover {
    background: ${COLORS.PRIMARY_LIGHT};
  }
`

export const SC_DropdownItem = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  background: none;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  color: ${COLORS.TEXT_PRIMARY};
  font-size: 13px;

  &:hover {
    background: ${COLORS.BG_HOVER_BLUE};
  }
`

export const SC_Avatar = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: ${COLORS.GRAY_E8};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: ${COLORS.WHITE};
  font-weight: 600;
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
  color: ${COLORS.TEXT_SECONDARY};
`

export const SC_TagCount = styled.span`
  font-size: 11px;
  color: ${COLORS.TEXT_HINT};
  margin-left: 6px;
`

export const SC_EmptyHint = styled.div`
  padding: 12px;
  text-align: center;
  color: ${COLORS.TEXT_HINT};
  font-size: 12px;
`

export const SC_LoadingHint = styled.div`
  padding: 12px;
  text-align: center;
  color: ${COLORS.TEXT_HINT};
  font-size: 12px;
`
