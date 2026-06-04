import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_DonateBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`

export const SC_Recipient = styled.div`
  font-size: 14px;
  color: ${COLORS.TEXT_SECONDARY};

  strong {
    color: ${COLORS.TEXT_PRIMARY};
    word-break: break-all;
  }
`

export const SC_PresetRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`

export const SC_PresetBtn = styled.button`
  flex: 1;
  min-width: 56px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid ${COLORS.BORDER};
  background-color: transparent;
  color: ${COLORS.TEXT_PRIMARY};
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.2s,
    color 0.2s,
    background-color 0.2s;

  &:hover {
    border-color: ${COLORS.BRAND_CYAN};
    color: ${COLORS.BRAND_CYAN};
  }

  &.active {
    border-color: ${COLORS.BRAND_CYAN};
    color: ${COLORS.BRAND_CYAN};
    background-color: ${COLORS.BRAND_CYAN_LIGHT};
  }
`

export const SC_AmountInput = styled.input`
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid ${COLORS.BORDER};
  background-color: ${COLORS.SURFACE_FROSTED};
  color: ${COLORS.TEXT_PRIMARY};
  font-size: 16px;
  font-weight: 600;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: ${COLORS.BRAND_CYAN};
  }
`

export const SC_BalanceHint = styled.div`
  font-size: 12px;
  color: ${COLORS.GRAY_999};
`

export const SC_FieldError = styled.div`
  font-size: 13px;
  color: ${COLORS.RED_ANT};
`
