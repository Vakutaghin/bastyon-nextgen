import styled from 'vue3-styled-components'
import { Z_INDEX } from '@/styles/design-tokens'
import { nuxtField } from '@/styles/field-styles'

export const SC_TransferWidget = styled.div`
  max-width: 560px;
  background: var(--ui-bg);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  overflow: hidden;
`

/** «Отправка / Получение» — вкладки pill, как у Nuxt UI (и переключатель
 * периода графика в эксплорере). */
export const SC_TransferSwitch = styled.div`
  display: flex;
  gap: 2px;
  margin: 24px 24px 0;
  padding: 4px;
  background: var(--ui-bg-elevated);
  border-radius: var(--ui-radius-lg);
`

export const SC_TransferSwitchBtn = styled('button', { active: Boolean })`
  flex: 1;
  padding: 6px 12px;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  color: ${(p) => (p.active ? 'var(--ui-text-inverted)' : 'var(--ui-text-muted)')};
  background: ${(p) => (p.active ? 'var(--ui-primary)' : 'transparent')};
  box-shadow: ${(p) => (p.active ? 'var(--ui-shadow-xs)' : 'none')};
  border: none;
  border-radius: var(--ui-radius-md);
  cursor: pointer;
  transition:
    color 0.15s ease,
    background 0.15s ease;

  &:hover {
    color: ${(p) => (p.active ? 'var(--ui-text-inverted)' : 'var(--ui-text-highlighted)')};
    background: ${(p) => (p.active ? 'var(--ui-primary)' : 'transparent')};
  }
`

export const SC_TransferBody = styled.div`
  padding: 24px;
`

export const SC_TransferField = styled.div`
  margin-bottom: 16px;
`

export const SC_TransferLabel = styled.label`
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-text);
  margin-bottom: 6px;
`

/** Поля формы — как UInput у Nuxt (outline, размер lg): рамка accented,
 * в фокусе акцентная рамка и ореол. */
export const SC_TransferInput = styled.input`
  ${nuxtField}
`

export const SC_TransferTextarea = styled.textarea`
  ${nuxtField}
  min-height: 72px;
  resize: vertical;
`

export const SC_TransferSelect = styled.select`
  ${nuxtField}
  cursor: pointer;
`

export const SC_TransferRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
`

/** Контейнер QR на приём: белый фон для контраста (в т.ч. в тёмной теме). */
export const SC_QrWrap = styled.div`
  display: flex;
  justify-content: center;
  margin: 4px 0 12px;

  img {
    width: 200px;
    height: 200px;
    padding: 10px;
    background: var(--color-white);
    border: 1px solid var(--color-border-default);
    border-radius: var(--ui-radius-lg);
  }
`

export const SC_TransferAddress = styled.div`
  flex: 1;
  font-family: var(--font-family-mono);
  font-size: 13px;
  color: var(--color-gray-212);
  word-break: break-all;
  padding: 10px 14px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-overlay-8);
  border-radius: var(--ui-radius-lg);
`

export const SC_TransferCopyBtn = styled.button`
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-gray-212);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-overlay-12);
  border-radius: var(--ui-radius-lg);
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    background: var(--color-bg-tertiary);
  }
`

/** Главная кнопка формы — solid-акцент Nuxt размера xl. Раньше фон был
 * «цветом заголовков»: в тёмной теме это белый, и белая подпись пропадала. */
export const SC_TransferSubmit = styled.button`
  width: 100%;
  margin-top: 20px;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  color: var(--ui-text-inverted);
  background: var(--ui-primary);
  border: none;
  border-radius: var(--ui-radius-md);
  cursor: pointer;

  &:hover:not(:disabled) {
    color: var(--ui-text-inverted);
    background: rgb(var(--ui-primary-rgb) / 75%);
  }

  &:disabled {
    opacity: 0.75;
    cursor: not-allowed;
  }
`

export const SC_TransferError = styled.div`
  margin-top: 12px;
  padding: 12px;
  font-size: 14px;
  color: var(--color-danger-deep);
  background: var(--color-danger-bg-soft);
  border-radius: var(--ui-radius-lg);
`

export const SC_TransferFieldError = styled.div`
  margin-top: 6px;
  font-size: 12px;
  color: var(--color-danger-deep);
`

export const SC_TransferSuccess = styled.div`
  margin-top: 12px;
  padding: 12px;
  font-size: 14px;
  color: var(--color-success-deep);
  background: var(--color-success-bg-soft);
  border-radius: var(--ui-radius-lg);
`

export const SC_TransferSearchWrap = styled.div`
  position: relative;
`

export const SC_TransferSearchDropdown = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  top: 100%;
  margin-top: 4px;
  max-height: 220px;
  overflow-y: auto;
  background: var(--ui-bg);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-md);
  box-shadow: var(--ui-shadow-lg);
  z-index: ${() => Z_INDEX.LOCAL_DROPDOWN};
`

export const SC_TransferSearchItem = styled.button`
  display: block;
  width: 100%;
  padding: 10px 14px;
  font-size: 14px;
  text-align: left;
  color: var(--color-gray-212);
  background: none;
  border: none;
  cursor: pointer;
  border-bottom: 1px solid var(--color-overlay-6);

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: var(--color-bg-light);
  }
`

export const SC_TransferSearchingHint = styled.div`
  font-size: 12px;
  color: var(--color-gray-120);
  margin-top: 4px;
`

export const SC_TransferLoginRequired = styled.div`
  color: var(--color-gray-120);
  font-size: 14px;
`

export const SC_TransferLoginChip = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--color-gray-120);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-overlay-8);
  border-radius: var(--ui-radius-lg);
  max-width: fit-content;
`

export const SC_TransferLoginChipText = styled.span`
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SC_TransferLoginChipRemove = styled.button`
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  padding: 0;
  font-size: 14px;
  line-height: 1;
  color: var(--color-gray-120);
  background: none;
  border: none;
  border-radius: var(--ui-radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: var(--color-gray-212);
    background: var(--color-overlay-6);
  }
`
