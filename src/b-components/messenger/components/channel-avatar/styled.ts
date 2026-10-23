import styled from 'vue3-styled-components'

export const SC_ChannelAvatar = styled('div', { size: Number })`
  position: relative;
  flex-shrink: 0;
  width: ${(p) => `${p.size}px`};
  height: ${(p) => `${p.size}px`};
`

/**
 * Мегафон в левом нижнем углу: справа внизу у аватара свой значок
 * (проверенный, модератор), а у авторов каналов он бывает часто.
 */
export const SC_ChannelBadge = styled('div', { size: Number })`
  position: absolute;
  left: -2px;
  bottom: -2px;
  width: ${(p) => `${Math.max(16, Math.round((p.size ?? 0) * 0.36))}px`};
  height: ${(p) => `${Math.max(16, Math.round((p.size ?? 0) * 0.36))}px`};
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${(p) => `${Math.max(10, Math.round((p.size ?? 0) * 0.22))}px`};
  color: var(--ui-text-inverted);
  background: var(--ui-violet);
  box-shadow: 0 0 0 2px var(--ui-bg);
  z-index: 2;
`
