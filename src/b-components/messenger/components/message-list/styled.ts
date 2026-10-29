import styled from 'vue3-styled-components'

export const SC_MessageList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`

/** Граница сохранённого на устройстве: черта с подписью посередине. */
export const SC_ArchiveDivider = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin: 4px 0;
  color: var(--ui-text-dimmed);
  font-size: 12px;
  line-height: calc(1.4 * var(--leading-scale));
  text-align: center;

  &::before,
  &::after {
    content: '';
    flex: 1;
    min-width: 16px;
    border-top: 1px dashed var(--ui-border-accented);
  }

  span {
    max-width: 360px;
  }
`
