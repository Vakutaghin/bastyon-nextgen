import styled from 'vue3-styled-components'

// SC_PostModalWrapper оборачивает окно, которое телепортится в #ui-layers:
// оформление окна поста на телефоне — в src/style.css (.ui-modal.post-modal).
export const SC_PostModalWrapper = styled.div`
  display: contents;
`

/** Пост в окне — без своей рамки: окно уже и есть карточка, рамка в рамке
 * съедала место и выглядела лишней. */
export const SC_PostModalContent = styled.div`
  padding: 0;

  .ui-card {
    --ui-card-padding: 0;

    border: 0;
    margin-bottom: 0;
    box-shadow: none;
  }
`

export const SC_PostModalTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`

/** «Открыть страницей» — рядом с заголовком окна, слева от крестика. */
export const SC_OpenPageLink = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--ui-radius-md);
  color: var(--ui-text-muted);
  font-size: 16px;

  &:hover,
  &:active {
    color: var(--ui-text-highlighted);
    background: var(--ui-bg-elevated);
  }
`
