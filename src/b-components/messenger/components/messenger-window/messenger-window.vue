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
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 3 L9 9 M9 3 L3 9" stroke="white" stroke-width="2" stroke-linecap="round" />
        </svg>
      </div>
    </SC_Header>

    <SC_Content>
      <slot />
    </SC_Content>
  </SC_Window>
</template>

<script lang="ts">
import { messengerWindowOptions } from './messenger-window'

export default messengerWindowOptions
</script>
