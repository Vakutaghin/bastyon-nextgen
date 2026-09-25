import styled from 'vue3-styled-components'
import { TRANSITIONS } from '@/styles/design-tokens'

export const SC_Perms = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

export const SC_PermsTitle = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_PermsLead = styled.p`
  margin: 0;
  font-size: 14px;
  color: var(--color-text-secondary);
`

export const SC_PermsState = styled.div`
  padding: 24px 0;
  text-align: center;
  font-size: 14px;
  color: var(--color-text-secondary);
`

export const SC_AppCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid var(--color-border-default);
  border-radius: var(--ui-radius-lg);
`

export const SC_AppHead = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`

export const SC_AppIcon = styled.div`
  width: 32px;
  height: 32px;
  border-radius: var(--ui-radius-lg);
  flex-shrink: 0;
  overflow: hidden;
  background: var(--color-bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: var(--color-text-secondary);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

export const SC_AppName = styled.span`
  flex: 1;
  min-width: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const SC_PermRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  border-top: 1px solid var(--color-border-lighter);
`

export const SC_PermInfo = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
`

export const SC_PermName = styled.span`
  font-size: 14px;
  color: var(--color-text-primary);
`

export const SC_PermMeta = styled.span`
  font-size: 12px;
  color: var(--color-text-muted);
`

export const SC_DeniedBadge = styled.span`
  font-size: 11px;
  padding: 2px 7px;
  border-radius: var(--ui-radius-lg);
  background: var(--color-red-bg);
  color: var(--color-danger);
`

export const SC_RevokeBtn = styled.button`
  flex-shrink: 0;
  padding: 5px 12px;
  border-radius: var(--ui-radius-md);
  border: 1px solid var(--color-border-default);
  background: var(--color-bg-secondary);
  color: var(--color-danger);
  font-size: 13px;
  cursor: pointer;
  transition: background ${TRANSITIONS.FAST};

  &:hover {
    background: var(--color-bg-hover);
  }
`

export const SC_RevokeAllBtn = styled.button`
  flex-shrink: 0;
  padding: 5px 12px;
  border-radius: var(--ui-radius-md);
  border: 1px solid var(--color-border-default);
  background: none;
  color: var(--color-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: background ${TRANSITIONS.FAST};

  &:hover {
    background: var(--color-bg-hover);
  }
`

/** Удаление сайдлоад-приложения из настроек (S51). */
export const SC_DeleteAppBtn = styled.button`
  flex-shrink: 0;
  padding: 5px 12px;
  border-radius: var(--ui-radius-md);
  border: 1px solid var(--color-danger);
  background: none;
  color: var(--color-danger);
  font-size: 13px;
  cursor: pointer;
  transition: background ${TRANSITIONS.FAST};

  &:hover {
    background: var(--color-bg-hover);
  }
`
