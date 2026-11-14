<template>
  <SC_Menu class="ui-menu" role="menu" @keydown="onKeydown">
    <template v-for="(item, index) in items" :key="item.key ?? `divider-${index}`">
      <li v-if="isDivider(item)" class="ui-menu__divider" role="separator" />
      <li
        v-else
        class="ui-menu__item"
        role="menuitem"
        tabindex="-1"
        :data-key="item.key"
        :data-danger="item.danger ? '' : undefined"
        :aria-disabled="item.disabled ? 'true' : undefined"
        @click="choose(item, $event)"
        @keydown="onItemKeydown(item, $event)"
      >
        <span v-if="item.icon" class="ui-menu__icon"><component :is="item.icon" /></span>
        <span class="ui-menu__label">
          <template v-if="typeof item.label === 'string'">{{ item.label }}</template>
          <component :is="item.label" v-else />
        </span>
      </li>
    </template>
  </SC_Menu>
</template>

<script setup lang="ts">
// Меню пунктов вместо antd Menu: значок, подпись, опасный и недоступный пункт,
// черта между группами. Внутри Dropdown выбор пункта закрывает панель.
import { isDivider, useMenu } from './menu'
import type { MenuEmits, MenuProps } from './types'
import { SC_Menu } from './styled'

defineProps<MenuProps>()
const emit = defineEmits<MenuEmits>()

const { choose, onKeydown, onItemKeydown } = useMenu(emit)
</script>
