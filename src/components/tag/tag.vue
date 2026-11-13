<template>
  <SC_Tag class="ui-tag"><slot /></SC_Tag>
</template>

<script setup lang="ts">
// Метка (теги и категории поста) вместо обёртки над antd Tag. Нажатие и
// класс потребителя — на сам span.
import { SC_Tag } from './styled'
</script>
