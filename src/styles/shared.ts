/**
 * Общие styled-примитивы, переиспользуемые между фичами.
 *
 * Сюда выносятся стили, которые иначе дублируются 1:1 в нескольких
 * `*.styled.ts` (audit §3.2). Локальные one-off стили остаются рядом со
 * своим компонентом — здесь только то, что действительно общее.
 *
 * Расширять под конкретную поверхность через `styled(SC_Base)` —
 * см. mini-apps-grid.styled.ts.
 */

import styled from 'vue3-styled-components'
import { COLORS } from './theme-colors'

/**
 * Заголовок секции в «карточном» стиле: мелкий капс с трекингом.
 * Используется в блок-эксплорере и каталоге мини-приложений.
 * Отступ оставлен нулевым — задаётся на месте использования
 * (через родителя-flex или `styled(SC_SectionTitleUpper)`).
 */
export const SC_SectionTitleUpper = styled.h2`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: ${COLORS.TEXT_PRIMARY};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`
