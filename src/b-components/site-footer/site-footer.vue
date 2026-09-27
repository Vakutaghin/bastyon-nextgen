<template>
  <SC_Footer>
    <SC_FooterInner>
      <SC_FooterBrand>{{ t('footer.brand') }}</SC_FooterBrand>
    </SC_FooterInner>
  </SC_Footer>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { SC_Footer, SC_FooterInner, SC_FooterBrand } from './site-footer.styled'

const { t } = useI18n()
</script>
