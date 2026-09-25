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
