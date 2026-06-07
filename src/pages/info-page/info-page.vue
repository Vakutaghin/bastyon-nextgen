<template>
  <SC_InfoPage>
    <template v-if="page">
      <SC_InfoTitle>{{ page.title }}</SC_InfoTitle>
      <SC_InfoLead v-if="page.lead">{{ page.lead }}</SC_InfoLead>

      <SC_InfoNote v-if="page.note === 'legalReview'">
        {{ t('infoPage.legalReviewNote') }}
      </SC_InfoNote>

      <SC_InfoSection v-for="(section, i) in page.sections" :key="i">
        <SC_InfoHeading v-if="section.heading">{{ section.heading }}</SC_InfoHeading>
        <SC_InfoParagraph v-for="(p, j) in section.paragraphs" :key="j">{{ p }}</SC_InfoParagraph>
      </SC_InfoSection>
    </template>

    <SC_InfoNotFound v-else>
      {{ t('infoPage.notFound') }}
      <div>
        <SC_InfoBack type="button" @click="goHome">{{ t('infoPage.backHome') }}</SC_InfoBack>
      </div>
    </SC_InfoNotFound>
  </SC_InfoPage>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getInfoPage } from '@/content/info-pages'
import {
  SC_InfoPage,
  SC_InfoTitle,
  SC_InfoLead,
  SC_InfoNote,
  SC_InfoSection,
  SC_InfoHeading,
  SC_InfoParagraph,
  SC_InfoNotFound,
  SC_InfoBack,
} from './info-page.styled'

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()

const slug = computed<string>(() =>
  typeof route.params.slug === 'string' ? route.params.slug : ''
)
const page = computed(() => getInfoPage(slug.value, locale.value))

function goHome(): void {
  void router.push('/')
}
</script>
