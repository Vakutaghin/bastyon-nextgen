import styled from 'vue3-styled-components'

const overlayProps = { isOpen: Boolean }

export const SC_Backdrop = styled('div', overlayProps)`
  position: fixed;
  inset: 0;
  /* Как оверлей Nuxt UI: светлая дымка bg-elevated/75, не чёрное затемнение. */
  background: rgb(var(--ui-bg-elevated-rgb) / 75%);
  z-index: 1100;
  opacity: ${(p) => (p.isOpen ? 1 : 0)};
  pointer-events: ${(p) => (p.isOpen ? 'auto' : 'none')};
  transition: opacity var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
`

export const SC_Drawer = styled('aside', overlayProps)`
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  width: min(320px, 86vw);
  background: var(--ui-bg);
  z-index: 1101;
  display: flex;
  flex-direction: column;
  box-shadow:
    0 0 0 1px var(--ui-border),
    var(--ui-shadow-lg);
  transform: translateX(${(p) => (p.isOpen ? '0' : '-100%')});
  transition: transform var(--transition-drawer);
  padding-top: var(--safe-top);
  padding-bottom: var(--safe-bottom);
  padding-left: var(--safe-left);
  -webkit-tap-highlight-color: transparent;
  overflow-y: auto;
  /* Пункты левой панели компьютера здесь под палец. */
  --sidebar-item-min-height: 44px;
`

export const SC_DrawerHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--ui-border);
`

/** Название и под ним номер версии; кнопка проверки — под палец. */
export const SC_DrawerBrand = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;

  --version-button-size: 32px;
`

export const SC_DrawerTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_DrawerClose = styled.button`
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--ui-radius-md);
  cursor: pointer;
  color: var(--ui-text);
  -webkit-tap-highlight-color: transparent;

  &:hover,
  &:active {
    background: var(--ui-bg-elevated);
  }
`

/** Вход и регистрация для гостя — две кнопки во всю ширину. */
export const SC_DrawerAuth = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 16px 8px;
`

/**
 * Блоки левой панели компьютера (вкладки, категории, теги) — с её же отступом
 * по краям: компоненты рассчитаны на него.
 */
export const SC_DrawerPanel = styled.div`
  display: flex;
  flex-direction: column;
  padding: 8px 16px;
`

/** Заголовок раздела — вровень с иконками пунктов (у них отступ 10px). */
export const SC_DrawerSectionTitle = styled.div`
  padding: 8px 10px 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`
