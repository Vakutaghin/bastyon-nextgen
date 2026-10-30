import styled from 'vue3-styled-components'

/**
 * Посты во всю ширину раздела, как сетка над ними: ширину задаёт страница по
 * кнопке ширины в шапке (--content-max-width). Своих 720 px у колонки больше
 * нет — с ними «Во всю ширину» в шапке на посты не действовало.
 */
export const SC_Posts = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
`
