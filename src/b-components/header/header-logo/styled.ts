import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
  height: 100%;
  flex-shrink: 0;

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    gap: 5px;
  }

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    margin-right: 20px;
  }
`

export const SC_LogoLink = styled.button`
  display: flex;
  align-items: center;
  height: 40px;
  background: none;
  border: none;
  padding: 0;
  transition: opacity 0.3s;
  cursor: pointer;

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    width: 31px;
    overflow: hidden;
  }

  &:hover {
    opacity: 0.8;
  }

  &:focus {
    border-radius: 4px;
  }
`

export const SC_LogoImg = styled.img`
  height: 32px;
  width: auto;
  object-fit: contain;
  display: block;
  pointer-events: none;
  user-select: none;
`

export const SC_LogoLang = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  height: 100%;
  color: ${COLORS.TEXT_PRIMARY};
  font-size: 13px;
  font-weight: 400;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 6px;
  transition: all 0.3s;
  background: transparent;
  border: 1px solid transparent;
  white-space: nowrap;

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    display: none;
  }

  &:hover {
    background: ${COLORS.BORDER_LIGHTER};
    border-color: ${COLORS.BORDER_LIGHTER};
  }
`

export const SC_LanguageFlag = styled.span`
  font-size: 16px;
  line-height: 1;
`

export const SC_LanguageName = styled.span`
  min-width: 0;

  /* На узком десктопе (769–1199px) в шапке одновременно видны поиск и полный
     правый блок иконок; поиск уже сжат до своего пола (~88px, дальше не жмётся),
     поэтому лишнюю ширину отдаёт логотип. Прячем текст локали, оставляя флаг и
     caret (клик всё так же открывает меню) — это освобождает ~55px под кнопки
     справа, чтобы шапка (position:fixed) не обрезала их за краем. */
  @media (max-width: ${BREAKPOINTS.DESKTOP}) {
    display: none;
  }
`
