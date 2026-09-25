// Тема ant-design-vue в оформлении Nuxt UI (см. шапку src/style.css).
//
// antd считает оттенки (hover, active, фоны алертов) из настоящих цветов, поэтому
// сюда нельзя передать var(--ui-*) — значения продублированы из палитры
// src/style.css. Совпадение проверяет antd-theme.test.ts: поменял цвет в CSS —
// поменяй и здесь.
//
// antd 4.2.6 почти не знает токенов компонентов, но в `components` можно
// переопределить общие токены для одного компонента — этим и пользуемся.

import { ConfigProvider, theme } from 'ant-design-vue'
import type { ThemeConfig } from 'ant-design-vue/es/config-provider/context'

/** Семантические цвета одной темы — те же, что `--ui-*` в style.css. */
export interface UiThemeColors {
  primary: string
  /** Нажатие и hover ссылок — как `a:hover` в style.css. */
  primaryStrong: string
  primaryText: string
  success: string
  info: string
  warning: string
  error: string
  text: string
  textMuted: string
  textDimmed: string
  textHighlighted: string
  textInverted: string
  bg: string
  bgMuted: string
  bgElevated: string
  bgAccented: string
  border: string
  borderAccented: string
  /** `--ui-bg-elevated` с прозрачностью: подложка пункта меню и маска модалки. */
  bgElevatedRgb: string
  primaryRgb: string
}

export const UI_THEME_COLORS: Record<'light' | 'dark', UiThemeColors> = {
  light: {
    primary: '#155dfc',
    primaryStrong: '#1447e6',
    primaryText: '#155dfc',
    success: '#00c16a',
    info: '#2b7fff',
    warning: '#f0b100',
    error: '#fb2c36',
    text: '#314158',
    textMuted: '#62748e',
    textDimmed: '#90a1b9',
    textHighlighted: '#0f172b',
    textInverted: '#fff',
    bg: '#fff',
    bgMuted: '#f8fafc',
    bgElevated: '#f1f5f9',
    bgAccented: '#e2e8f0',
    border: '#e2e8f0',
    borderAccented: '#cad5e2',
    bgElevatedRgb: '241, 245, 249',
    primaryRgb: '21, 93, 252',
  },
  dark: {
    primary: '#00dc82',
    primaryStrong: '#75edae',
    primaryText: '#00dc82',
    success: '#00dc82',
    info: '#51a2ff',
    warning: '#fdc700',
    error: '#ff6467',
    text: '#e2e8f0',
    textMuted: '#90a1b9',
    textDimmed: '#62748e',
    textHighlighted: '#fff',
    textInverted: '#0f172b',
    bg: '#0f172b',
    bgMuted: '#1d293d',
    bgElevated: '#1d293d',
    bgAccented: '#314158',
    border: '#1d293d',
    borderAccented: '#314158',
    bgElevatedRgb: '29, 41, 61',
    primaryRgb: '0, 220, 130',
  },
}

/** Тень оверлеев Nuxt (shadow-lg) плюс кольцо-рамка `ring ring-default`. */
function overlayShadow(c: UiThemeColors): string {
  return (
    `0 0 0 1px ${c.border}, 0 10px 15px -3px rgba(0, 0, 0, 0.1), ` +
    '0 4px 6px -4px rgba(0, 0, 0, 0.1)'
  )
}

export function buildAntdTheme(isDark: boolean): ThemeConfig {
  const c = UI_THEME_COLORS[isDark ? 'dark' : 'light']

  return {
    algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: c.primary,
      colorSuccess: c.success,
      colorWarning: c.warning,
      colorError: c.error,
      colorInfo: c.info,
      colorLink: c.primaryText,
      colorLinkHover: c.primaryStrong,

      colorText: c.text,
      colorTextHeading: c.textHighlighted,
      colorTextSecondary: c.textMuted,
      colorTextDescription: c.textMuted,
      colorTextTertiary: c.textDimmed,
      colorTextQuaternary: c.textDimmed,
      colorTextPlaceholder: c.textDimmed,
      colorTextDisabled: c.textDimmed,
      colorIcon: c.textDimmed,
      colorIconHover: c.text,

      colorBgBase: c.bg,
      colorBgContainer: c.bg,
      colorBgElevated: c.bg,
      colorBgLayout: c.bgMuted,
      colorBgContainerDisabled: c.bgElevated,
      colorBgTextHover: c.bgElevated,
      colorBgTextActive: c.bgAccented,
      // Маска модалки у Nuxt — светлая дымка bg-elevated/75, а не чёрная.
      colorBgMask: `rgba(${c.bgElevatedRgb}, 0.75)`,

      colorBorder: c.borderAccented,
      colorBorderSecondary: c.border,
      colorSplit: c.border,

      colorFill: c.bgAccented,
      colorFillSecondary: c.bgElevated,
      colorFillTertiary: c.bgElevated,
      colorFillQuaternary: c.bgMuted,

      // Пункты меню и выпадашек: hover — elevated/50, выбранный — elevated.
      controlItemBgHover: `rgba(${c.bgElevatedRgb}, 0.5)`,
      controlItemBgActive: c.bgElevated,
      controlItemBgActiveHover: c.bgAccented,

      // Ореол фокуса полей как у Nuxt: 3px акцентом на 25%.
      controlOutline: `rgba(${c.primaryRgb}, 0.25)`,
      controlOutlineWidth: 3,

      boxShadow: overlayShadow(c),
      boxShadowSecondary: overlayShadow(c),
      boxShadowTertiary: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',

      fontFamily: 'var(--font-family)',
      fontSize: 14,

      borderRadius: 6,
      borderRadiusLG: 8,
      borderRadiusSM: 4,
      borderRadiusXS: 2,

      controlHeight: 32,
      controlHeightSM: 28,
      controlHeightLG: 36,
    },
    components: {
      // Ширина ореола у antd рисует ещё и «тень» под кнопками — у Nuxt её нет.
      // Текст на заливке — --ui-text-inverted: белый на синем, в тёмной теме тёмный на зелёном.
      Button: { controlOutlineWidth: 0, colorTextLightSolid: c.textInverted },
      // Шапка и футер отделены линиями, как у модалки Nuxt.
      Modal: { wireframe: true },
      // Тултип у Nuxt светлый в светлой теме: фон страницы, рамка, мелкий текст.
      Tooltip: {
        colorBgDefault: c.bg,
        colorTextLightSolid: c.textHighlighted,
        fontSize: 12,
        controlHeight: 24,
        borderRadius: 4,
      },
      // Select как USelect (обёртка components/select): радиус 6 и у поля, и у
      // списка с пунктами; большой (36px) — с текстом 14px, как поля форм;
      // выбранный пункт отмечен галочкой, а не жирным.
      Select: {
        borderRadiusLG: 6,
        borderRadiusSM: 6,
        fontSizeLG: 14,
        fontWeightStrong: 400,
      },
      // 36×20 с бегунком 16, выключенный — bg-accented.
      Switch: {
        fontSize: 14,
        lineHeight: 20 / 14,
        colorTextQuaternary: c.bgAccented,
        colorTextTertiary: c.borderAccented,
      },
    },
  }
}

/**
 * Тема для Modal.confirm, notification и message: они рендерятся вне дерева
 * приложения и берут её из глобального конфига antd, а не из <ConfigProvider>.
 *
 * `ConfigProvider.config` типизирован под тему antd 3 (`{ primaryColor }`), но
 * кладёт параметры целиком в globalConfigForApi, а modal/confirm.js отдаёт
 * оттуда `theme` в <ConfigProvider> — в рантайме это ThemeConfig.
 */
export function setStaticApiTheme(config: ThemeConfig): void {
  const setGlobalConfig = ConfigProvider.config as unknown as (params: {
    theme: ThemeConfig
  }) => void
  setGlobalConfig({ theme: config })
}
