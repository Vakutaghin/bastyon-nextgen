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
    color: inherit !important;
  }

  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 0 !important;
  flex-shrink: 0 !important;
  position: relative !important;
`

export const SC_VideoQualityButton = styled.button`
  background: transparent !important;
  border: none !important;
  cursor: pointer !important;
  padding: 8px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  border-radius: 4px !important;
  transition: background-color 0.2s ease !important;
  color: var(--color-text-primary) !important;
  flex-shrink: 0 !important;
  width: 40px !important;
  height: 40px !important;
  min-width: 40px !important;
  min-height: 40px !important;
  box-sizing: border-box !important;
  position: relative !important;

  &:hover {
    background: var(--color-overlay-8) !important;
  }

  &:active {
    background: var(--color-overlay-12) !important;
  }

  &:focus {
    outline: none !important;
  }
`

export const SC_VideoQualityDropdown = styled.div<{
  isOpen?: boolean
}>`
  position: absolute !important;
  bottom: 100% !important;
  left: 0 !important;
  margin-bottom: 8px !important;
  background: var(--color-bg-primary) !important;
  color: var(--color-text-primary) !important;
  border: 1px solid var(--color-border-lighter) !important;
  border-radius: 8px !important;
  box-shadow: var(--shadow-md) !important;
  min-width: 140px !important;
  overflow: visible !important;
  opacity: ${(p) => (p.isOpen ? 1 : 0)} !important;
  visibility: ${(p) => (p.isOpen ? 'visible' : 'hidden')} !important;
  pointer-events: ${(p) => (p.isOpen ? 'auto' : 'none')} !important;
  transition:
    opacity 0.2s ease,
    visibility 0.2s ease !important;
  z-index: 1000 !important;
`

export const SC_VideoQualityMenuSection = styled.div`
  padding: 0 !important;
`

export const SC_VideoQualityMenuSectionTitle = styled.div`
  padding: 0 !important;
`

export const SC_VideoQualitySubmenuItem = styled.button<{ isOpen?: boolean }>`
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  width: 100% !important;
  padding: 6px 12px !important;
  background: transparent !important;
  border: none !important;
  cursor: pointer !important;
  color: var(--color-text-primary) !important;
  font-size: 12px !important;
  font-weight: 400 !important;
  font-family: var(--font-family) !important;
  transition: background-color 0.15s ease !important;
  text-align: left !important;
  box-sizing: border-box !important;
  position: relative !important;

  &:hover {
    background: var(--color-overlay-8) !important;
  }

  &:active {
    background: var(--color-overlay-12) !important;
  }

  &:focus {
    outline: none !important;
  }

  &:not(:last-child) {
    border-bottom: 1px solid var(--color-border-lighter) !important;
  }
`

export const SC_VideoQualitySubmenu = styled.div<{ isOpen?: boolean }>`
  position: absolute !important;
  left: 0 !important;
  bottom: 100% !important;
  margin-bottom: 4px !important;
  background: var(--color-bg-primary) !important;
  color: var(--color-text-primary) !important;
  border: 1px solid var(--color-border-lighter) !important;
  border-radius: 8px !important;
  box-shadow: var(--shadow-md) !important;
  min-width: 90px !important;
  max-width: 110px !important;
  overflow: hidden !important;
  opacity: ${(p) => (p.isOpen ? 1 : 0)} !important;
  visibility: ${(p) => (p.isOpen ? 'visible' : 'hidden')} !important;
  pointer-events: ${(p) => (p.isOpen ? 'auto' : 'none')} !important;
  transition:
    opacity 0.2s ease,
    visibility 0.2s ease !important;
  z-index: 1001 !important;
  white-space: nowrap !important;
`

export const SC_VideoQualitySubmenuItemInner = styled.button<{ isActive?: boolean }>`
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  width: 100% !important;
  padding: 4px 10px !important;
  background: transparent !important;
  border: none !important;
  cursor: pointer !important;
  color: ${(p) => (p.isActive ? '#ff0000' : 'var(--color-text-primary)')} !important;
  font-size: 11px !important;
  font-weight: ${(p) => (p.isActive ? '600' : '400')} !important;
  font-family: var(--font-family) !important;
  transition:
    background-color 0.15s ease,
    color 0.15s ease !important;
  text-align: left !important;
  box-sizing: border-box !important;
  white-space: nowrap !important;

  &:hover {
    background: var(--color-overlay-8) !important;
  }

  &:active {
    background: var(--color-overlay-12) !important;
  }

  &:focus {
    outline: none !important;
  }

  &:not(:last-child) {
    border-bottom: 1px solid var(--color-border-lighter) !important;
  }
`

export const SC_VideoQualityMenuItem = styled.button<{ isActive?: boolean }>`
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  width: 100% !important;
  padding: 6px 12px !important;
  background: transparent !important;
  border: none !important;
  cursor: pointer !important;
  color: ${(p) => (p.isActive ? '#ff0000' : 'var(--color-text-primary)')} !important;
  font-size: 12px !important;
  font-weight: ${(p) => (p.isActive ? '600' : '400')} !important;
  font-family: var(--font-family) !important;
  transition:
    background-color 0.15s ease,
    color 0.15s ease !important;
  text-align: left !important;
  box-sizing: border-box !important;

  &:hover {
    background: var(--color-overlay-8) !important;
  }

  &:active {
    background: var(--color-overlay-12) !important;
  }

  &:focus {
    outline: none !important;
  }

  &:not(:last-child) {
    border-bottom: 1px solid var(--color-border-lighter) !important;
  }
`
