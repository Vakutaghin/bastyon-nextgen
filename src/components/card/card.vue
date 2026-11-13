<template>
  <SC_Card class="ui-card">
    <div class="ui-card__body"><slot /></div>
  </SC_Card>
</template>

<script setup lang="ts">
// Карточка (пост в ленте) вместо обёртки над antd Card: рамка, фон и тело с
// отступом. Отступ тела — `--ui-card-padding` на карточке: его меняют правила
// style.css (планшет, телефон, окно поста), не зная разметки.
import { SC_Card } from './styled'
</script>
