<template>
  <SC_Footer>
    <SC_FooterInner>
      <SC_FooterLinks>
        <RouterLink v-for="link in links" :key="link.slug" :to="`/info/${link.slug}`">
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

const links = computed(() => getInfoPageLinks(locale.value))
</script>
