import styled from 'vue3-styled-components'

export const SC_Application = styled.div`
  width: 100%;
  min-height: 100vh;
  position: relative;
`

export const SC_Camera = styled.div`
  display: none;
`

export const SC_Appcnt = styled.div`
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding-bottom: var(--safe-bottom);

  /* Когда видна нижняя навигация (моб/планшет) — резервируем под неё место,
     чтобы фиксированный бар (высота 56px + safe-area) не перекрывал контент. */
  &.has-bottom-nav {
    /* Та же переменная, что задаёт высоту самого бара, — чтобы отступ контента
       и бар не разъезжались. */
    padding-bottom: var(--bottom-nav-height-total);
  }
`
