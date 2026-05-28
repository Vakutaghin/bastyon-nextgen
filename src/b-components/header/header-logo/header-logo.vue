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
import { computed, h, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Dropdown, Menu } from 'ant-design-vue'
import type { MenuProps } from 'ant-design-vue'
import { CaretDownOutlined, CheckOutlined } from '@ant-design/icons-vue'
import { logoData as initialLogoData } from '@/b-components/header/dummy-data/logo-data'
import {
  SC_Logo,
  SC_LogoLink,
  SC_LogoImg,
  SC_LogoLang,
  SC_LanguageFlag,
  SC_LanguageName,
} from './styled'

const router = useRouter()

// Реактивная копия — currentLanguage обновляется без мутации модуля.
const logoData = ref({
  ...initialLogoData,
  languages: initialLogoData.languages.slice(),
})

const currentLanguageName = computed<string>(() => {
  const lang = logoData.value.languages.find((l) => l.code === logoData.value.currentLanguage)
  return lang ? lang.name : 'Русский'
})

const currentLanguageFlag = computed<string>(() => {
  const lang = logoData.value.languages.find((l) => l.code === logoData.value.currentLanguage)
  return lang ? lang.flag : '🇷🇺'
})

const languageMenuItems = computed<MenuProps['items']>(() =>
  logoData.value.languages.map((lang) => {
    const isSelected = lang.code === logoData.value.currentLanguage
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
  logoData.value.currentLanguage = key
  // TODO: интегрировать с useLocale() — сейчас словари есть только для ru/en.
}

function handleLogoClick(): void {
  router.push('/')
}
</script>
