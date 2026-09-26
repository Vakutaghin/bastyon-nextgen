import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

// Брейкпоинт — функцией: строка в шаблоне styled не проходит проверку типов.

export const SC_FilesWork = styled.div`
  display: flex;
  flex: 1;
  width: 100%;
  min-height: calc(100vh - var(--header-height));
  padding: 0 0 25px;
  align-items: flex-start;
  background: var(--color-bg-primary);
`

export const SC_FilesPage = styled.main`
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

export const SC_FilesHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
`

export const SC_FilesTitle = styled.h1`
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_FilesActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`

/** Цвет состояния ноды: раздаёт — зелёный, запускается — жёлтый, иначе серый. */
function nodeColor(state: string): string {
  if (state === 'running') return 'var(--ui-success)'
  if (state === 'starting') return 'var(--ui-warning)'
  return 'var(--ui-text-dimmed)'
}

export const SC_FilesStatus = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  font-size: 14px;
  color: var(--ui-text);
`

/** Точка и текст статуса: на узком экране текст переносится, а точка остаётся с ним. */
export const SC_FilesStatusText = styled.span`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex: 1 1 240px;
  min-width: 0;
`

export const SC_FilesDot = styled('span', { state: String })`
  width: 8px;
  height: 8px;
  margin-top: 6px;
  border-radius: var(--ui-radius-full);
  flex-shrink: 0;
  background: ${(p) => nodeColor(p.state ?? '')};
`

export const SC_FilesNote = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ui-text-muted);
`

export const SC_FilesLinkButton = styled.button`
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  color: var(--ui-primary);
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
`

export const SC_FilesEmpty = styled.div`
  padding: 40px 16px;
  border: 1px dashed var(--ui-border-accented);
  border-radius: var(--ui-radius-lg);
  text-align: center;
  font-size: 14px;
  color: var(--ui-text-muted);
`

export const SC_FilesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

export const SC_FilesRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  background: var(--ui-bg);

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    flex-wrap: wrap;
  }
`

export const SC_FilesIcon = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  font-size: 18px;
  color: var(--ui-text-muted);
`

export const SC_FilesMain = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
`

export const SC_FilesName = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-text-highlighted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const SC_FilesMeta = styled.span`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--ui-text-muted);
`

/** Копия на сервисе: сохранена — зелёный, копируется — жёлтый, ошибка — красный. */
function remoteColor(status: string): string {
  if (status === 'pinned') return 'var(--ui-success)'
  if (status === 'failed') return 'var(--ui-error)'
  return 'var(--ui-warning-text)'
}

export const SC_FilesRemote = styled('span', { status: String })`
  color: ${(p) => remoteColor(p.status ?? '')};
`

export const SC_FilesRowActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    width: 100%;
    justify-content: flex-start;
  }
`
