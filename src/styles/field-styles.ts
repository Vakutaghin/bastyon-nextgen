import { BREAKPOINTS } from './design-tokens'

/**
 * Нативное поле ввода (input, textarea, select) в оформлении Nuxt UI — как
 * UInput, вариант outline, размер lg: фон страницы, рамка accented, радиус 6,
 * высота 36px. В фокусе — акцентная рамка и ореол 3px, как у antd-полей
 * (components/input). На телефоне шрифт 16px: с меньшим iOS увеличивает
 * страницу при фокусе.
 *
 * Раньше у каждого поля было своё оформление: радиус 4, 6 или 8, рамка трёх
 * разных цветов, в фокусе то голубая рамка, то никакой. В окне перевода PKOIN
 * текст был цвета тёмного фона — в тёмной теме набранное не читалось.
 *
 * Подключается функцией, а не строкой: строковая интерполяция в шаблоне
 * vue3-styled-components — ошибка vue-tsc.
 *
 *   export const SC_Input = styled.input`
 *     ${nuxtField}
 *     min-height: 72px; // своё — после
 *   `
 */
export const nuxtField = (): string => `
  width: 100%;
  box-sizing: border-box;
  padding: 7px 12px;
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  color: var(--ui-text-highlighted);
  background: var(--ui-bg);
  border: 1px solid var(--ui-border-accented);
  border-radius: var(--ui-radius-md);
  outline: none;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;

  &::placeholder {
    color: var(--ui-text-dimmed);
  }

  &:focus {
    border-color: var(--ui-primary);
    box-shadow: 0 0 0 3px rgb(var(--ui-primary-rgb) / 25%);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.75;
  }

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    font-size: 16px;
  }
`
