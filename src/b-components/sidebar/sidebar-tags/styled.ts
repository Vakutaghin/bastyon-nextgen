import styled, { css } from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

const selectedProps = {
  selected: Boolean,
}

export const SC_Tags = styled.div``

export const SC_TagsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 11px;
  cursor: pointer;
`

export const SC_TagsControls = styled.div`
  margin-left: auto;
  margin-right: 8px;
`

export const SC_TagsReset = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  color: ${COLORS.TEXT_SECONDARY};
  transition: color 0.2s;

  &:hover {
    color: ${COLORS.TEXT_PRIMARY};
  }
`

export const SC_TagsTitle = styled.h3`
  font-size: 13px;
  font-weight: 600;
  color: ${COLORS.TEXT_PRIMARY};
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 1px;
`

export const SC_TagsToggle = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  color: ${COLORS.TEXT_SECONDARY};
  transition: color 0.2s;

  &:hover {
    color: ${COLORS.TEXT_PRIMARY};
  }
`

export const SC_TagsLoading = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80px;
  padding: 16px 0;
  color: ${COLORS.TEXT_SECONDARY};
`

export const SC_TagsList = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
`

export const SC_TagsCount = styled.span`
  font-size: 10px;
  color: ${COLORS.TEXT_SECONDARY};
  background: ${COLORS.TEXT_MUTED};
  padding: 1.88px 4px;
  border-radius: 8px;
  font-weight: 600;
  flex-shrink: 0;
`

export const SC_TagsItem = styled('button', selectedProps)`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 7px;
  background: ${COLORS.PRIMARY_LIGHT};
  border: 1px solid ${COLORS.PRIMARY_LIGHT_30};
  border-radius: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
  color: ${COLORS.PRIMARY};
  font-size: 11px;
  font-weight: 500;

  &:hover {
    background: ${COLORS.PRIMARY_LIGHT_20};
    border-color: ${COLORS.PRIMARY_LIGHT_50};
  }

  &:focus {
    outline: none;
  }

  ${(props) =>
    props.selected &&
    css`
      background: ${COLORS.PRIMARY};
      color: ${COLORS.WHITE};
      border-color: ${COLORS.PRIMARY};

      &:hover {
        background: ${COLORS.PRIMARY_HOVER};
        border-color: ${COLORS.PRIMARY_ACTIVE};
      }

      ${SC_TagsCount} {
        background: ${COLORS.WHITE_20};
        color: ${COLORS.WHITE};
      }
    `}
`

export const SC_TagsName = styled.span`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
`
