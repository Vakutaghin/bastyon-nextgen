import styled from 'vue3-styled-components'
import { nuxtField } from '@/styles/field-styles'

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
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary);
`

export const SC_Input = styled.input`
  ${nuxtField}
`

export const SC_Textarea = styled.textarea`
  ${nuxtField}
  min-height: 88px;
  resize: vertical;
`

export const SC_Select = styled.select`
  ${nuxtField}
  cursor: pointer;
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
  border: 1px solid var(--color-border);
`

export const SC_AvatarPlaceholder = styled.div`
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 500;
  color: var(--ui-text-inverted);
  background-color: var(--color-brand-cyan);
`

export const SC_AvatarActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

export const SC_SmallBtn = styled.button`
  padding: 6px 12px;
  border-radius: var(--ui-radius-md);
  border: 1px solid var(--color-border);
  background-color: transparent;
  color: var(--color-text-primary);
  font-size: 12px;
  cursor: pointer;
  transition:
    border-color 0.2s,
    color 0.2s;

  &:hover {
    border-color: var(--color-brand-cyan);
    color: var(--color-brand-cyan);
  }

  &.danger:hover {
    border-color: var(--color-red-ant);
    color: var(--color-red-ant);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

export const SC_HiddenFileInput = styled.input`
  display: none;
`
