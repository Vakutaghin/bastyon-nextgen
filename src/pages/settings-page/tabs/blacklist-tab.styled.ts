import styled from 'vue3-styled-components'
import { TRANSITIONS } from '@/styles/design-tokens'

export const SC_Blacklist = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

export const SC_BlacklistTitle = styled.h2`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_BlacklistLead = styled.p`
  margin: 0;
  font-size: 14px;
  color: var(--color-text-secondary);
`

export const SC_BlacklistList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

export const SC_BlacklistRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border-radius: var(--ui-radius-lg);
  border: 1px solid var(--color-border-default);
`

export const SC_BlacklistMain = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
`

export const SC_BlacklistAvatar = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  flex-shrink: 0;
  overflow: hidden;
  background: var(--color-bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  color: var(--color-text-secondary);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

export const SC_BlacklistName = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-text-highlighted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color var(--transition-quick);

  /* Строка целиком — кнопка перехода в профиль: на наведении имя как ссылка. */
  button:hover > * > &,
  button:hover > & {
    color: var(--ui-primary-text);
  }
`

export const SC_UnblockBtn = styled.button`
  flex-shrink: 0;
  padding: 6px 14px;
  border-radius: var(--ui-radius-md);
  border: 1px solid var(--color-border-default);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  font-size: 12px;
  cursor: pointer;
  transition: background ${TRANSITIONS.FAST};

  &:hover:not(:disabled) {
    background: var(--color-bg-hover);
  }

  &:disabled {
    opacity: 0.75;
    cursor: not-allowed;
  }
`

export const SC_BlacklistState = styled.div`
  padding: 24px 0;
  text-align: center;
  font-size: 14px;
  color: var(--color-text-secondary);
`
