<template>
  <SC_UpNext data-testid="up-next">
    <SC_Countdown v-if="countdown !== null" role="status">
      <span>{{ t('media.nextIn', { n: countdown }) }}</span>
      <strong>{{ queue.upcoming[0]?.title || t('media.untitled') }}</strong>
      <Button size="small" type="primary" @click="goNext">{{ t('media.playNow') }}</Button>
      <Button size="small" @click="cancel">{{ t('media.cancel') }}</Button>
    </SC_Countdown>

    <SC_Head>
      <div class="titles">
        <span class="label">{{ t('media.upNext') }}</span>
        <span class="source">{{ queue.source?.title }}</span>
      </div>
      <SC_HeadButton
        type="button"
        :aria-label="t('media.previous')"
        :disabled="!queue.hasPrevious"
        @click="previous"
      >
        <SkipBackIcon />
      </SC_HeadButton>
      <SC_HeadButton
        type="button"
        :aria-label="t('media.next')"
        :disabled="!queue.hasNext"
        @click="goNext"
      >
        <SkipForwardIcon />
      </SC_HeadButton>
      <SC_HeadButton
        type="button"
        :class="{ on: queue.shuffle }"
        :aria-pressed="queue.shuffle"
        :aria-label="t('media.shuffle')"
        @click="queue.toggleShuffle()"
      >
        <ShuffleIcon />
      </SC_HeadButton>
      <SC_HeadButton
        type="button"
        :class="{ on: queue.repeat !== 'off' }"
        :aria-label="
          t(
            queue.repeat === 'one'
              ? 'media.repeatOne'
              : queue.repeat === 'all'
                ? 'media.repeatAll'
                : 'media.repeatOff'
          )
        "
        @click="queue.cycleRepeat()"
      >
        <RepeatOneIcon v-if="queue.repeat === 'one'" />
        <RepeatIcon v-else />
      </SC_HeadButton>
      <SC_HeadButton type="button" :aria-label="t('media.closeQueue')" @click="close">
        <CloseOutlined />
      </SC_HeadButton>
    </SC_Head>

    <SC_List>
      <li v-for="index in queue.order" :key="queue.items[index]?.id ?? index">
        <SC_Row
          v-if="queue.items[index]"
          type="button"
          :class="{ current: index === queue.currentIndex }"
          @click="jump(index)"
        >
          <span class="cover">
            <img
              v-if="queue.items[index]!.cover"
              :src="queue.items[index]!.cover!"
              alt=""
              loading="lazy"
            />
          </span>
          <span class="text">
            <span class="title">{{ queue.items[index]!.title || t('media.untitled') }}</span>
            <span class="artist">{{ queue.items[index]!.artist }}</span>
          </span>
          <span class="duration">{{ formatDuration(queue.items[index]!.duration) }}</span>
        </SC_Row>
      </li>
    </SC_List>
  </SC_UpNext>
</template>

<script setup lang="ts">
// «Далее» на странице поста: очередь роликов (плейлист, «Сохранённые»),
// следующий по концу ролика — через 5 секунд, которые можно отменить.

import { onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from 'ant-design-vue'
import {
  CloseOutlined,
  RepeatIcon,
  RepeatOneIcon,
  ShuffleIcon,
  SkipBackIcon,
  SkipForwardIcon,
} from '@/components/icons'
import { usePlayback } from '@/composables/use-playback'
import { formatDuration } from '@/services/media/media-post'
import { SC_Countdown, SC_Head, SC_HeadButton, SC_List, SC_Row, SC_UpNext } from './up-next.styled'

/** Секунд до следующего ролика. */
const COUNTDOWN = 5

const { t } = useI18n()
const { queue, next, previous, jump } = usePlayback()

const countdown = ref<number | null>(null)
let timer: ReturnType<typeof setInterval> | null = null

function stopTimer(): void {
  if (timer) clearInterval(timer)
  timer = null
  countdown.value = null
}

/** Ролик доиграл: «повтор одного» — тот же сразу, иначе отсчёт до следующего. */
function onEnded(): void {
  if (queue.repeat === 'one') {
    next(true)
    return
  }
  if (!queue.hasNext) return
  countdown.value = COUNTDOWN
  timer = setInterval(() => {
    if (countdown.value === null) return
    countdown.value -= 1
    if (countdown.value <= 0) goNext()
  }, 1000)
}

function goNext(): void {
  stopTimer()
  next()
}

function cancel(): void {
  stopTimer()
}

function close(): void {
  stopTimer()
  queue.clear()
}

onBeforeUnmount(stopTimer)

defineExpose({ onEnded })
</script>
