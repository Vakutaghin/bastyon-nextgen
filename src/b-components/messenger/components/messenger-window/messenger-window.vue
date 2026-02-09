<template>
  <SC_Window :isOpen="isOpen">
    <SC_Header>
      <slot name="actions" />
      <SC_Title>{{ title }}</SC_Title>
      <div
        aria-label="Закрыть"
        role="button"
        @click="$emit('close')"
        :style="{
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          marginLeft: '8px'
        }"
      >
        <img :src="closeIcon" alt="Закрыть" width="12" height="12" />
      </div>
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
  data () {
    return { closeIcon }
  },
}
</script>
