import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_Form = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

export const SC_Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

export const SC_Label = styled.label`
  font-size: 13px;
  font-weight: 500;
  color: ${COLORS.TEXT_SECONDARY};
`

export const SC_Input = styled.input`
  width: 100%;
  padding: 9px 12px;
  border-radius: 8px;
  border: 1px solid ${COLORS.BORDER};
  background-color: ${COLORS.SURFACE_FROSTED};
  color: ${COLORS.TEXT_PRIMARY};
  font-size: 14px;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: ${COLORS.BRAND_CYAN};
  }
`

export const SC_Textarea = styled.textarea`
  width: 100%;
  min-height: 88px;
  resize: vertical;
  padding: 9px 12px;
  border-radius: 8px;
  border: 1px solid ${COLORS.BORDER};
  background-color: ${COLORS.SURFACE_FROSTED};
  color: ${COLORS.TEXT_PRIMARY};
  font-size: 14px;
  font-family: inherit;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: ${COLORS.BRAND_CYAN};
  }
`

export const SC_Select = styled.select`
  width: 100%;
  padding: 9px 12px;
  border-radius: 8px;
  border: 1px solid ${COLORS.BORDER};
  background-color: ${COLORS.SURFACE_FROSTED};
  color: ${COLORS.TEXT_PRIMARY};
  font-size: 14px;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: ${COLORS.BRAND_CYAN};
  }
`

export const SC_CharCount = styled.span`
  align-self: flex-end;
  font-size: 11px;
  color: ${COLORS.GRAY_999};
`

export const SC_AvatarRow = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`

export const SC_AvatarPreview = styled.img`
  width: 72px;
  height: 72px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid ${COLORS.BORDER};
`

export const SC_AvatarPlaceholder = styled.div`
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 600;
  color: ${COLORS.WHITE};
  background-color: ${COLORS.BRAND_CYAN};
`

export const SC_AvatarActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

export const SC_SmallBtn = styled.button`
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid ${COLORS.BORDER};
  background-color: transparent;
  color: ${COLORS.TEXT_PRIMARY};
  font-size: 13px;
  cursor: pointer;
  transition:
    border-color 0.2s,
    color 0.2s;

  &:hover {
    border-color: ${COLORS.BRAND_CYAN};
    color: ${COLORS.BRAND_CYAN};
  }

  &.danger:hover {
    border-color: ${COLORS.RED_ANT};
    color: ${COLORS.RED_ANT};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

export const SC_HiddenFileInput = styled.input`
  display: none;
`
