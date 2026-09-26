<template>
  <SC_Footer>
    <SC_FooterInner>
      <SC_FooterLinks>
        <RouterLink v-for="link in links" :key="link.to" :to="link.to">
          {{ link.title }}
        </RouterLink>
      </SC_FooterLinks>
      <SC_FooterBrand>{{ t('footer.brand') }}</SC_FooterBrand>
    </SC_FooterInner>
  </SC_Footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getInfoPageLinks } from '@/content/info-pages'
import { SC_Footer, SC_FooterInner, SC_FooterLinks, SC_FooterBrand } from './site-footer.styled'

const { t, locale } = useI18n()

// Сначала справка, потом поддержка и юридические страницы.
const links = computed(() => [
  { to: '/help', title: t('footer.help') },
  { to: '/help/about', title: t('footer.about') },
  { to: '/help/faq', title: t('footer.faq') },
  ...getInfoPageLinks(locale.value).map((link) => ({
    to: `/info/${link.slug}`,
    title: link.title,
  })),
])
</script>
