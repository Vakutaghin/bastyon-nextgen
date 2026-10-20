import styled from 'vue3-styled-components'

// Та же карточка, что у голосового ввода: модули приложения выглядят одинаково.
export {
  SC_VoiceCard as SC_ModuleCard,
  SC_VoiceHead as SC_ModuleHead,
  SC_VoiceTitle as SC_ModuleTitle,
  SC_VoiceStatus as SC_ModuleStatus,
  SC_VoiceDesc as SC_ModuleDesc,
} from './voice-input-section.styled'

export const SC_ModuleActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--color-text-secondary);
`

export const SC_ModuleError = styled.div`
  font-size: 13px;
  color: var(--ui-error);
`
