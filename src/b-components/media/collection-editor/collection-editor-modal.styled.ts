import styled from 'vue3-styled-components'

export const SC_Editor = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: min(70vh, 640px);
  overflow-y: auto;
  margin: 0 -8px;
  padding: 0 8px;

  .label {
    font-size: 13px;
    font-weight: 600;
    color: var(--ui-text-highlighted);
  }
`

const FIELD = `
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--ui-border-accented);
  border-radius: var(--ui-radius-md);
  background: var(--ui-bg);
  color: var(--ui-text);
  font: inherit;
  font-size: 14px;
`

export const SC_Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;

  input,
  textarea {
    ${() => FIELD}
  }

  textarea {
    resize: vertical;
    min-height: 72px;
  }

  input:focus,
  textarea:focus {
    outline: 2px solid rgb(var(--ui-primary-rgb) / 40%);
    border-color: var(--ui-primary);
  }

  .counter {
    align-self: flex-end;
    font-size: 12px;
    color: var(--ui-text-dimmed);
    font-variant-numeric: tabular-nums;
  }

  .counter.over {
    color: var(--ui-error);
  }
`

export const SC_CoverRow = styled.div`
  display: flex;
  gap: 14px;
  align-items: flex-start;

  .cover-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .hint {
    font-size: 12px;
    color: var(--ui-text-muted);
  }

  .cover-actions {
    display: flex;
    gap: 6px;
    margin-top: 4px;
  }
`

export const SC_CoverPreview = styled.div`
  flex: none;
  width: 128px;
  aspect-ratio: 16 / 9;
  border-radius: var(--ui-radius-md);
  overflow: hidden;
  background: var(--ui-bg-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: var(--ui-text-dimmed);

  &.square {
    width: 88px;
    aspect-ratio: 1 / 1;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

export const SC_ItemsHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;

  .count {
    font-size: 12px;
    color: var(--ui-text-dimmed);
    font-variant-numeric: tabular-nums;
  }

  .count.over {
    color: var(--ui-error);
  }
`

export const SC_Items = styled.ol`
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-md);
  overflow: hidden;

  &:empty {
    display: none;
  }
`

export const SC_Item = styled.li`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  background: var(--ui-bg);
  font-size: 13px;

  & + & {
    border-top: 1px solid var(--ui-border);
  }

  &.dragging {
    background: rgb(var(--ui-primary-rgb) / 8%);
  }

  .num {
    flex: none;
    width: 22px;
    text-align: right;
    color: var(--ui-text-dimmed);
    font-variant-numeric: tabular-nums;
  }

  .title {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .title.gone {
    color: var(--ui-text-dimmed);
    font-style: italic;
  }
`

const ICON_BUTTON = `
  flex: none;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: var(--ui-radius-sm);
  background: none;
  color: var(--ui-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  &:hover {
    background: var(--ui-bg-muted);
    color: var(--ui-text);
  }
`

export const SC_Handle = styled.button`
  ${() => ICON_BUTTON}
  cursor: grab;
  touch-action: none;
`

export const SC_Remove = styled.button`
  ${() => ICON_BUTTON}
`

export const SC_Picker = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-md);

  &:empty {
    display: none;
  }
`

export const SC_PickRow = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  border: 0;
  background: none;
  color: var(--ui-text);
  font-size: 13px;
  text-align: left;
  cursor: pointer;

  span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &:hover:not(:disabled) {
    background: var(--ui-bg-muted);
  }

  &.on {
    color: var(--ui-primary);
  }

  &.more {
    justify-content: center;
    color: var(--ui-primary);
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`

export const SC_Note = styled.p`
  margin: 0;
  font-size: 12px;
  line-height: calc(1.4 * var(--leading-scale));
  color: var(--ui-text-muted);
`

export const SC_Error = styled.p`
  margin: 0;
  font-size: 13px;
  color: var(--ui-error);
`

export const SC_Status = styled.p`
  margin: 0;
  font-size: 13px;
  color: var(--ui-text-muted);
`
