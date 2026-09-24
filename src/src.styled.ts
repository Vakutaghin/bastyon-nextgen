import styled from 'vue3-styled-components'

/** Заглушка вместо приложения, когда его встроили во фрейм чужого сайта (S67). */
export const SC_FramedNotice = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 24px;
  text-align: center;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
`

export const SC_FramedLink = styled.a`
  color: var(--color-primary);
  font-weight: 600;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`
