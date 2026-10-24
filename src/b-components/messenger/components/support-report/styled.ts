import styled from 'vue3-styled-components'

/**
 * Окошко со сведениями: ширина задана заранее, высота ограничена, текст
 * прокручивается внутри — сообщение сразу занимает своё место и не прыгает.
 */
export const SC_ReportBox = styled.div`
  width: 420px;
  max-width: 100%;
  min-width: 0;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-md);
  background: var(--ui-bg);
  overflow: hidden;
  white-space: normal;

  &.tall {
    width: 100%;
  }
`

export const SC_ReportHead = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 2px 2px 10px;
  border-bottom: 1px solid var(--ui-border);
  font-size: 12px;
  line-height: calc(1.3 * var(--leading-scale));
  color: var(--ui-text-muted);
`

export const SC_ReportIcon = styled.span`
  display: inline-flex;
  flex: 0 0 auto;
  color: var(--ui-primary);
`

export const SC_ReportTitle = styled.span`
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
  color: var(--ui-text);
`

export const SC_ReportPart = styled.span`
  flex: 0 0 auto;
  white-space: nowrap;
`

export const SC_CopyButton = styled.button`
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--ui-radius-sm);
  background: transparent;
  color: var(--ui-text-muted);
  cursor: pointer;
  transition: background var(--transition-fast);

  &:hover {
    background: var(--ui-bg-elevated);
    color: var(--ui-text);
  }

  &.done {
    color: var(--ui-primary);
  }
`

export const SC_ReportCode = styled.pre`
  margin: 0;
  padding: 8px 10px;
  max-height: 180px;
  overflow: auto;
  font-family: var(--font-family-mono);
  font-size: 11.5px;
  line-height: calc(1.45 * var(--leading-scale));
  white-space: pre;
  word-break: normal;
  tab-size: 2;
  color: var(--ui-text-toned);
  background: transparent;

  &.tall {
    max-height: 260px;
  }
`

/** Закреплённая полоса над перепиской в чате с поддержкой. */
export const SC_SupportBar = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  flex: 0 0 auto;
  padding: 8px 12px;
  border: 0;
  border-bottom: 1px solid var(--ui-border);
  background: rgb(var(--ui-primary-rgb) / 8%);
  color: var(--ui-text);
  font-size: 13px;
  line-height: calc(1.3 * var(--leading-scale));
  text-align: left;
  cursor: pointer;
  transition: background var(--transition-fast);

  &:hover {
    background: rgb(var(--ui-primary-rgb) / 14%);
  }

  &:focus-visible {
    outline: 2px solid var(--ui-primary);
    outline-offset: -2px;
  }
`

export const SC_SupportBarText = styled.span`
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
`

export const SC_SupportBarTitle = styled.span`
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SC_SupportBarHint = styled.span`
  font-size: 12px;
  color: var(--ui-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SC_SupportBarAction = styled.span`
  flex: 0 0 auto;
  padding: 4px 10px;
  border-radius: var(--ui-radius-md);
  background: var(--ui-primary);
  color: var(--ui-text-inverted);
  font-size: 12px;
  font-weight: 500;
`

export const SC_ConsentText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 14px;
  line-height: calc(1.45 * var(--leading-scale));
  color: var(--ui-text);

  p {
    margin: 0;
  }

  ul {
    margin: 0;
    padding-left: 20px;
  }

  li + li {
    margin-top: 2px;
  }
`

export const SC_ConsentNote = styled.p`
  font-size: 13px;
  color: var(--ui-text-muted);
`

export const SC_ConsentPreviewLabel = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-text-muted);
`
