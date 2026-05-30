<template>
  <SC_Logo>
    <SC_LogoLink @click="handleLogoClick">
      <SC_LogoImg :src="logoData.logoWhite" :alt="logoData.siteName" />
    </SC_LogoLink>

    <Dropdown :trigger="['click']" placement="bottomLeft">
      <SC_LogoLang>
        <SC_LanguageFlag>{{ currentLanguageFlag }}</SC_LanguageFlag>
        <SC_LanguageName>{{ currentLanguageName }}</SC_LanguageName>
        <CaretDownOutlined />
      </SC_LogoLang>

      <template #overlay>
        <Menu :items="languageMenuItems" @click="handleLanguageChange" />
      </template>
    </Dropdown>
  </SC_Logo>
</template>

<script setup lang="ts">
import { computed, h } from 'vue'
import { useRouter } from 'vue-router'
import { Dropdown, Menu } from 'ant-design-vue'
import type { MenuProps } from 'ant-design-vue'
import { CaretDownOutlined, CheckOutlined } from '@ant-design/icons-vue'
import { logoData } from '@/b-components/header/dummy-data/logo-data'
import { useLocale } from '@/composables/use-locale'
import type { Locale } from '@/i18n'
import {
  SC_Logo,
  SC_LogoLink,
  SC_LogoImg,
  SC_LogoLang,
  SC_LanguageFlag,
  SC_LanguageName,
} from './styled'

const router = useRouter()
const { locale, setLocale, available } = useLocale()

// Из всего dummy-data списка показываем только локали, для которых есть словари
// в src/locales/. По мере добавления переводов SUPPORTED_LOCALES расширяется.
const languageOptions = computed(() =>
  logoData.languages.filter((l) => (available.value as readonly string[]).includes(l.code))
)

const currentLanguageName = computed<string>(() => {
  const lang = languageOptions.value.find((l) => l.code === locale.value)
  return lang ? lang.name : 'Русский'
})

const currentLanguageFlag = computed<string>(() => {
  const lang = languageOptions.value.find((l) => l.code === locale.value)
  return lang ? lang.flag : '🇷🇺'
})

const languageMenuItems = computed<MenuProps['items']>(() =>
  languageOptions.value.map((lang) => {
    const isSelected = lang.code === locale.value
    return {
      key: lang.code,
      label: h(
        'span',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
          },
        },
        [
          h('span', { style: { fontSize: '18px', lineHeight: '1' } }, lang.flag),
          h('span', { style: { flex: '1' } }, lang.name),
          isSelected
            ? h(CheckOutlined, {
                style: {
                  marginLeft: 'auto',
                  color: 'var(--color-ant-blue)',
                  fontSize: '16px',
                },
              })
            : null,
        ]
      ),
    }
  })
)

function handleLanguageChange({ key }: { key: string }): void {
  // Защита: only known locales (отфильтрованы в languageOptions, но проверяем
  // ещё раз — мало ли key пришёл со старого dropdown).
  if ((available.value as readonly string[]).includes(key)) {
    setLocale(key as Locale)
  }
}

function handleLogoClick(): void {
  router.push('/')
}
</script>
