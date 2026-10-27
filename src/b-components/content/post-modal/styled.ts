import styled from 'vue3-styled-components'

// SC_PostModalWrapper оборачивает antd <Modal>, который телепортится в <body>,
// поэтому :deep(.ant-modal-*) отсюда не доходил. Цвета/оформление модалок теперь
// живут глобально в src/style.css (блок «Ant Design Modal»), общий для всех.
export const SC_PostModalWrapper = styled.div`
  display: contents;
`

/** Пост в окне — без своей рамки: окно уже и есть карточка, рамка в рамке
 * съедала место и выглядела лишней. */
export const SC_PostModalContent = styled.div`
  padding: 0;

  .bastyon-card.ant-card {
    border: 0;
    margin-bottom: 0;
    box-shadow: none;
  }

  .bastyon-card > .ant-card-body {
    padding: 0;
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
