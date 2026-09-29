import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'
import { nuxtField } from '@/styles/field-styles'

// Брейкпоинт — функцией: строка в шаблоне styled не проходит проверку типов.

export const SC_MeshWork = styled.div`
  display: flex;
  flex: 1;
  width: 100%;
  min-height: calc(100vh - var(--header-height));
  padding: 0 0 25px;
  align-items: flex-start;
  background: var(--color-bg-primary);
`

export const SC_MeshPage = styled.main`
  width: 100%;
  max-width: 880px;
  margin: 0 auto;
  padding: 60px 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    padding: 24px 16px;
  }
`

export const SC_MeshHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
`

export const SC_MeshTitle = styled.h1`
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_MeshStatus = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--ui-text-muted);
`

function statusColor(state: string): string {
  if (state === 'connected') return 'var(--ui-success)'
  if (state === 'connecting' || state === 'reconnecting') return 'var(--ui-warning)'
  return 'var(--ui-text-dimmed)'
}

export const SC_MeshDot = styled('span', { state: String })`
  width: 8px;
  height: 8px;
  border-radius: var(--ui-radius-full);
  flex-shrink: 0;
  background: ${(p) => statusColor(p.state ?? '')};
`

export const SC_MeshLead = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ui-text-muted);
`

export const SC_MeshCard = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  background: var(--ui-bg);
`

export const SC_MeshCardHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
`

export const SC_MeshCardTitle = styled.h2`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_MeshCount = styled.span`
  margin-left: 6px;
  font-weight: 400;
  color: var(--ui-text-dimmed);
`

export const SC_MeshSubtitle = styled.h3`
  margin: 8px 0 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_MeshNote = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--ui-text-muted);
`

export const SC_MeshWarn = styled.p`
  margin: 0;
  padding: 8px 12px;
  border-radius: var(--ui-radius-md);
  font-size: 13px;
  line-height: 1.45;
  color: var(--ui-text-highlighted);
  background: rgb(var(--ui-warning-rgb) / 12%);
`

export const SC_MeshError = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--ui-error);
`

export const SC_MeshRow = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
`

export const SC_MeshTabs = styled.div`
  display: flex;
  gap: 4px;
  padding: 3px;
  border-radius: var(--ui-radius-md);
  background: var(--ui-bg-elevated);
  align-self: flex-start;
`

export const SC_MeshTab = styled('button', { active: Boolean })`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border: none;
  border-radius: var(--ui-radius-sm);
  font-size: 13px;
  cursor: pointer;
  color: ${(p) => (p.active ? 'var(--ui-text-highlighted)' : 'var(--ui-text-muted)')};
  background: ${(p) => (p.active ? 'var(--ui-bg)' : 'transparent')};
  box-shadow: ${(p) => (p.active ? '0 1px 2px rgb(var(--color-black-rgb) / 10%)' : 'none')};
  transition: background-color var(--transition-fast);
`

export const SC_MeshList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-md);
  overflow: hidden;
`

export const SC_MeshItem = styled.li`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--ui-border);

  &:last-child {
    border-bottom: none;
  }

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    flex-wrap: wrap;
  }
`

export const SC_MeshItemIcon = styled.span`
  display: inline-flex;
  font-size: 16px;
  color: var(--ui-text-muted);
  flex-shrink: 0;
`

export const SC_MeshItemMain = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`

export const SC_MeshItemName = styled.span`
  font-size: 14px;
  color: var(--ui-text-highlighted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SC_MeshItemMeta = styled.span`
  font-size: 12px;
  color: var(--ui-text-dimmed);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SC_MeshItemActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
`

export const SC_MeshProps = styled.dl`
  margin: 0;
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 6px 16px;
  font-size: 13px;

  dt {
    color: var(--ui-text-dimmed);
  }

  dd {
    margin: 0;
    color: var(--ui-text-highlighted);
    overflow-wrap: anywhere;
  }
`

export const SC_MeshMono = styled.span`
  font-family: var(--font-family-mono);
  font-size: 12px;
`

export const SC_MeshForm = styled.form`
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 8px;
`

export const SC_MeshField = styled.label`
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 200px;
  font-size: 12px;
  color: var(--ui-text-muted);
`

/** Короткое поле (порт). */
export const SC_MeshFieldNarrow = styled(SC_MeshField)`
  flex: 0 0 96px;
`

export const SC_MeshInput = styled.input`
  ${nuxtField}
`

export const SC_MeshDetails = styled.details`
  font-size: 13px;
  color: var(--ui-text-muted);

  summary {
    cursor: pointer;
    margin-bottom: 8px;
  }
`

export const SC_MeshLinkButton = styled.button`
  border: none;
  background: none;
  padding: 0;
  font-size: 13px;
  color: var(--ui-primary);
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
`

/** Переключатель сетей (Meshtastic, MeshCore) над содержимым страницы. */
export const SC_MeshNetworks = styled.div`
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: var(--ui-radius-lg);
  background: var(--ui-bg-elevated);
  align-self: flex-start;
  max-width: 100%;
  overflow-x: auto;
`

export const SC_MeshNetwork = styled('button', { active: Boolean })`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 16px;
  border: none;
  border-radius: var(--ui-radius-md);
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  color: ${(p) => (p.active ? 'var(--ui-text-highlighted)' : 'var(--ui-text-muted)')};
  background: ${(p) => (p.active ? 'var(--ui-bg)' : 'transparent')};
  box-shadow: ${(p) => (p.active ? '0 1px 2px rgb(var(--color-black-rgb) / 10%)' : 'none')};
  transition: background-color var(--transition-fast);
`

export const SC_MeshSelect = styled.select`
  ${nuxtField}
`

/** Короткая метка у узла или канала («нет ключа», «избранный»). */
export const SC_MeshBadge = styled.span`
  display: inline-block;
  margin-left: 6px;
  padding: 0 6px;
  border-radius: var(--ui-radius-sm);
  font-size: 11px;
  font-weight: 500;
  line-height: 18px;
  vertical-align: middle;
  color: var(--ui-text-muted);
  background: var(--ui-bg-elevated);
`
