<template>
  <SC_TorBlockedNotice role="note">
    <SC_TorBlockedIcon aria-hidden="true"><SafetyOutlined /></SC_TorBlockedIcon>
    <span>{{ message }}</span>
  </SC_TorBlockedNotice>
</template>

<script setup lang="ts">
// Заглушка на месте встраивания (YouTube, превью композера, мини-аппа), которое
// под Tor не грузим: оно ушло бы напрямую, с реальным IP (V21, вариант B).
import { SafetyOutlined } from '@/components/icons'

import { SC_TorBlockedIcon, SC_TorBlockedNotice } from './styled'

defineProps<{ message: string }>()
</script>
