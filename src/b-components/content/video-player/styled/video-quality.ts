// @ts-expect-error vue3-styled-components types
import styled from 'vue3-styled-components'

export const SC_SubmenuArrow = styled.span`
  font-size: 10px;
  /* Не свой цвет, а приглушённый цвет пункта: так стрелка остаётся читаемой
     в обеих темах и не зависит от того, кто выиграет за color этого span. */
  color: inherit;
  opacity: 0.6;
  margin-left: 8px;
`

export const SC_VideoQualityControl = styled.div`
  /* Плеер лежит внутри ant-карточки поста, а её глобальное правило в style.css
     (.ant-card-body span -> color: var(--color-text) !important) перекрашивает
     любой вложенный span. В тёмной теме подписи пунктов меню становились
     белыми на белом. Здесь специфичность выше (класс + два типа), поэтому
     span берёт цвет своей кнопки. */
  button span {
    color: inherit;
  }

  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 0;
  flex-shrink: 0;
  position: relative;
`

export const SC_VideoQualityButton = styled.button`
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--ui-radius-sm);
  transition: background-color var(--transition-fast);
  color: var(--color-text-primary);
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  min-width: 40px;
  min-height: 40px;
  box-sizing: border-box;
  position: relative;

  &:hover {
    background: var(--color-overlay-8);
  }

  &:active {
    background: var(--color-overlay-12);
  }

  &:focus {
    outline: none;
  }
`

export const SC_VideoQualityDropdown = styled.div<{
  isOpen?: boolean
}>`
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: 8px;
  padding: 4px;
  background: var(--ui-bg);
  color: var(--ui-text);
  border-radius: var(--ui-radius-md);
  box-shadow:
    0 0 0 1px var(--ui-border),
    var(--ui-shadow-lg);
  min-width: 140px;
  overflow: visible;
  opacity: ${(p) => (p.isOpen ? 1 : 0)};
  visibility: ${(p) => (p.isOpen ? 'visible' : 'hidden')};
  pointer-events: ${(p) => (p.isOpen ? 'auto' : 'none')};
  transition:
    opacity var(--transition-fast),
    visibility var(--transition-fast);
  z-index: 1000;
`

export const SC_VideoQualityMenuSection = styled.div`
  padding: 0;
`

export const SC_VideoQualityMenuSectionTitle = styled.div`
  padding: 0;
`

export const SC_VideoQualitySubmenuItem = styled.button<{ isOpen?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 6px 12px;
  background: transparent;
  border: none;
  cursor: pointer;
  border-radius: var(--ui-radius-md);
  color: var(--ui-text);
  font-size: 12px;
  font-weight: 400;
  font-family: var(--font-family);
  transition:
    background-color var(--transition-quick),
    color var(--transition-quick);
  text-align: left;
  box-sizing: border-box;
  position: relative;

  &:hover {
    background: rgb(var(--ui-bg-elevated-rgb) / 50%);
    color: var(--ui-text-highlighted);
  }

  &:active {
    background: var(--ui-bg-elevated);
  }

  &:focus {
    outline: none;
  }
`

export const SC_VideoQualitySubmenu = styled.div<{ isOpen?: boolean }>`
  position: absolute;
  left: 0;
  bottom: 100%;
  margin-bottom: 4px;
  padding: 4px;
  background: var(--ui-bg);
  color: var(--ui-text);
  border-radius: var(--ui-radius-md);
  box-shadow:
    0 0 0 1px var(--ui-border),
    var(--ui-shadow-lg);
  min-width: 90px;
  max-width: 110px;
  overflow: hidden;
  opacity: ${(p) => (p.isOpen ? 1 : 0)};
  visibility: ${(p) => (p.isOpen ? 'visible' : 'hidden')};
  pointer-events: ${(p) => (p.isOpen ? 'auto' : 'none')};
  transition:
    opacity var(--transition-fast),
    visibility var(--transition-fast);
  z-index: 1001;
  white-space: nowrap;
`

export const SC_VideoQualitySubmenuItemInner = styled.button<{ isActive?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  padding: 4px 10px;
  background: transparent;
  border: none;
  cursor: pointer;
  border-radius: var(--ui-radius-md);
  color: ${(p) => (p.isActive ? 'var(--ui-primary)' : 'var(--ui-text)')};
  font-size: 12px;
  font-weight: ${(p) => (p.isActive ? '500' : '400')};
  font-family: var(--font-family);
  transition:
    background-color var(--transition-quick),
    color var(--transition-quick);
  text-align: left;
  box-sizing: border-box;
  white-space: nowrap;

  &:hover {
    background: rgb(var(--ui-bg-elevated-rgb) / 50%);
  }

  &:active {
    background: var(--ui-bg-elevated);
  }

  &:focus {
    outline: none;
  }
`

export const SC_VideoQualityMenuItem = styled.button<{ isActive?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  padding: 6px 12px;
  background: transparent;
  border: none;
  cursor: pointer;
  border-radius: var(--ui-radius-md);
  color: ${(p) => (p.isActive ? 'var(--ui-primary)' : 'var(--ui-text)')};
  font-size: 12px;
  font-weight: ${(p) => (p.isActive ? '500' : '400')};
  font-family: var(--font-family);
  transition:
    background-color var(--transition-quick),
    color var(--transition-quick);
  text-align: left;
  box-sizing: border-box;

  &:hover {
    background: rgb(var(--ui-bg-elevated-rgb) / 50%);
  }

  &:active {
    background: var(--ui-bg-elevated);
  }

  &:focus {
    outline: none;
  }
`
