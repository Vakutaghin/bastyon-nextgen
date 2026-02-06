<template>
  <SC_Logo>
    <SC_LogoLink @click="handleLogoClick">
      <SC_LogoImg
        :src='logoData.logoWhite'
        :alt='logoData.siteName'
      />
    </SC_LogoLink>

    <Dropdown
      :trigger="['click']"
      placement="bottomLeft"
    >
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

<script>
import { headerLogoOptions } from './header-logo.ts'

export default headerLogoOptions
</script>

