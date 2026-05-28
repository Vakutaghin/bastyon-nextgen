<template>
  <SC_Window :isOpen="isOpen">
    <SC_Header>
      <slot name="actions" />
      <SC_Title>{{ title }}</SC_Title>
      <button
        type="button"
        aria-label="Закрыть"
        @click="$emit('close')"
        :style="{
          appearance: 'none',
          border: 'none',
          padding: 0,
          background: 'transparent',
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          marginLeft: '8px',
        }"
      >
        <img :src="closeIcon" alt="" width="12" height="12" />
      </button>
    </SC_Header>

    <SC_Content>
      <slot />
    </SC_Content>
  </SC_Window>
</template>

<script lang="ts">
import { messengerWindowOptions } from './messenger-window'
import closeIcon from './img/close.svg'

export default {
  ...messengerWindowOptions,
  data() {
    return { closeIcon }
  },
}
</script>
