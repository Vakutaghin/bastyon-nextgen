import styled from 'vue3-styled-components'

// Аватар в оформлении Nuxt UI (UAvatar): круг без рамки, инициалы 500-м
// начертанием. Значки «подтверждён» и «ждёт регистрации» — точки с кольцом
// цвета фона, как UChip.
export const SC_Avatar = styled.div<{
  shape?: 'circle' | 'square'
}>`
  position: relative;
  border-radius: ${(p) => (p.shape === 'square' ? 'var(--ui-radius-sm)' : '50%')};
  overflow: visible;

  .ant-avatar {
    border: 0;
    border-radius: ${(p) => (p.shape === 'square' ? 'var(--ui-radius-sm)' : '50%')};
    font-weight: 500;
  }

  .ant-avatar img {
    object-fit: cover;
    border-radius: ${(p) => (p.shape === 'square' ? 'var(--ui-radius-sm)' : '50%')};
  }

  .verified-badge,
  .pending-badge {
    position: absolute;
    bottom: -2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    box-shadow: 0 0 0 2px var(--ui-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
  }

  .verified-badge {
    right: -2px;
    background: var(--ui-primary);
  }

  .pending-badge {
    left: -2px;
    background: var(--ui-warning);
  }
`
