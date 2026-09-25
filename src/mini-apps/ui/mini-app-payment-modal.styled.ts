import styled from 'vue3-styled-components'
import { SPACING } from '@/styles/design-tokens'

export const SC_Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.MD};
`

export const SC_AppRow = styled.div`
  color: var(--color-gray-120);
  font-size: 13px;
`

export const SC_RecieverList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.XS};
  border: 1px solid var(--color-gray-e0);
  border-radius: var(--ui-radius-lg);
  padding: ${SPACING.SM};
`

export const SC_RecieverRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${SPACING.MD};
  font-size: 14px;
`

export const SC_RecieverAddr = styled.span`
  font-family: var(--font-family-mono);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 60%;
  color: var(--color-gray-120);
`

export const SC_RecieverAmount = styled.span`
  font-weight: 600;
  white-space: nowrap;
`

export const SC_TotalRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 15px;
  font-weight: 600;
`

export const SC_TotalAmount = styled.span`
  color: var(--color-primary);
`

export const SC_FeeRow = styled.div`
  font-size: 12px;
  color: var(--color-gray-120);
`

export const SC_MessageRow = styled.div`
  font-size: 13px;
  color: var(--color-gray-120);
  padding: ${SPACING.SM};
  background: var(--color-gray-f1);
  border-radius: var(--ui-radius-md);
`

export const SC_Error = styled.div`
  color: var(--color-danger);
  font-size: 13px;
`
