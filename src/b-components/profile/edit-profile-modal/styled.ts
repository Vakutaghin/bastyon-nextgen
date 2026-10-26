import styled from 'vue3-styled-components'
import { nuxtField } from '@/styles/field-styles'
import { BREAKPOINTS } from '@/styles/design-tokens'

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
  background-color: var(--ui-primary);
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
    border-color var(--transition-fast),
    color var(--transition-fast);

  &:hover {
    border-color: var(--ui-primary);
    color: var(--ui-primary);
  }

  &.danger:hover {
    border-color: var(--color-red-ant);
    color: var(--color-red-ant);
  }

  &:disabled {
    opacity: 0.75;
    cursor: not-allowed;
  }
`

export const SC_HiddenFileInput = styled.input`
  display: none;
`

export const SC_Hint = styled.p`
  margin: 0;
  font-size: 12px;
  color: var(--ui-text-muted);
`

export const SC_FieldError = styled.p`
  margin: 0;
  font-size: 12px;
  color: var(--color-red-ant);
`

export const SC_AddressList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const SC_AddressRow = styled.li`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px 6px 12px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-md);
`

export const SC_AddressCurrency = styled.span`
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--ui-text-muted);
`

export const SC_AddressValue = styled.span`
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-family: var(--font-family-mono);
  color: var(--ui-text-highlighted);
  overflow-wrap: anywhere;
`

export const SC_AddressAdd = styled.div`
  display: grid;
  grid-template-columns: minmax(120px, 160px) 1fr auto;
  gap: 8px;
  align-items: center;

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    grid-template-columns: 1fr auto;

    & > :first-child {
      grid-column: 1 / -1;
    }
  }
`
