<template>
  <SC_DevUiPage>
    <SC_DevUiTitle>Р’РёС‚СЂРёРЅР° РєРѕРјРїРѕРЅРµРЅС‚РѕРІ</SC_DevUiTitle>
    <SC_DevUiLead>
      РћР±С‰РёРµ РєРѕРјРїРѕРЅРµРЅС‚С‹ РёР· @/components РІРѕ РІСЃРµС… РІР°СЂРёР°РЅС‚Р°С… Рё
      СЃРѕСЃС‚РѕСЏРЅРёСЏС…. РЎС‚СЂР°РЅРёС†Р° РµСЃС‚СЊ С‚РѕР»СЊРєРѕ РІ dev-СЃР±РѕСЂРєРµ. РўРµРјСѓ Рё
      СЂРµР¶РёРј РєРѕРЅС‚СЂР°СЃС‚Р° РїРµСЂРµРєР»СЋС‡Р°С‚СЊ РІ С€Р°РїРєРµ Рё РЅР°СЃС‚СЂРѕР№РєР°С….
    </SC_DevUiLead>
    <ButtonSection />
    <FeedbackSection />
    <ChoiceSection />
  </SC_DevUiPage>
</template>

<script setup lang="ts">
// Р’РёС‚СЂРёРЅР° СЃРІРѕРёС… РєРѕРјРїРѕРЅРµРЅС‚РѕРІ, РєРѕС‚РѕСЂС‹Рµ Р·Р°РјРµРЅСЏСЋС‚ ant-design-vue: РјРµСЃС‚Рѕ РґР»СЏ
// РІРёР·СѓР°Р»СЊРЅРѕР№ СЃРІРµСЂРєРё РІ РѕР±РµРёС… С‚РµРјР°С… Рё РґР»СЏ РїСЂРѕРІРµСЂРѕРє СЃ РєР»Р°РІРёР°С‚СѓСЂС‹. РљР°Р¶РґС‹Р№ РЅРѕРІС‹Р№
// РєРѕРјРїРѕРЅРµРЅС‚ РґРѕР±Р°РІР»СЏРµС‚ СЃСЋРґР° СЃРІРѕР№ СЂР°Р·РґРµР» (sections/<РёРјСЏ>-section.vue).
import ButtonSection from './sections/button-section.vue'
import FeedbackSection from './sections/feedback-section.vue'
import ChoiceSection from './sections/choice-section.vue'
import { SC_DevUiLead, SC_DevUiPage, SC_DevUiTitle } from './dev-ui-page.styled'
</script>
