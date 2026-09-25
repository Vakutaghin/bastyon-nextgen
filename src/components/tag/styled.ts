import styled from 'vue3-styled-components'

// Тег в оформлении Nuxt UI — нейтральный бейдж (UBadge, soft): подложка
// elevated, 12px/500, радиус 6. Акцентом — только выбранный.
export const SC_Tag = styled.div`
  .ant-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin: 0;
    padding: 4px 8px;
    border: 0;
    border-radius: var(--ui-radius-md);
    background: var(--ui-bg-elevated);
    color: var(--ui-text);
    font-size: 12px;
    font-weight: 500;
    line-height: 16px;
    transition: background-color 0.15s;
  }

  .ant-tag:hover {
    background: var(--ui-bg-accented);
  }

  .ant-tag-checkable-checked,
  .ant-tag-checkable-checked:hover {
    background: var(--ui-primary);
    color: var(--ui-text-inverted);
  }
`
