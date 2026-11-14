import styled from 'vue3-styled-components'

// Подтверждение как было у antd Popconfirm в нашей теме: панель 280px (на
// узком экране — с зазором 12px до краёв), значок предупреждения 14px у
// заголовка, пояснение под заголовком с отступом под значок, кнопки справа.
//
// Части для styled родителя: .ui-popconfirm, __message, __icon, __title,
// __description, __buttons.
export const SC_Popconfirm = styled.div`
  width: calc(min(280px, 100vw - 24px) - 2 * var(--ui-popover-padding, 12px));

  .ui-popconfirm__message {
    display: flex;
    align-items: flex-start;
    margin-bottom: 8px;
  }

  .ui-popconfirm__icon {
    flex: none;
    padding-top: 4px;
    color: var(--ui-warning);
    font-size: 14px;
    line-height: 1;
  }

  .ui-popconfirm__title {
    flex: auto;
    margin-left: 8px;
    font-weight: 600;
  }

  .ui-popconfirm__description {
    margin: 0 0 8px 22px;
  }

  .ui-popconfirm__buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
`
