<template>
  <Dropdown
    v-if="isAuthenticated && pendingCount > 0"
    v-model:open="visible"
    :trigger="['click']"
    placement="bottomRight"
    :getPopupContainer="trigger => trigger.closest('header') || document.body"
  >
    <SC_EventsWrapper>
      <Badge :count="pendingCount" :offset="[0, 5]" :number-style="{ backgroundColor: '#1890ff' }">
        <HourglassOutlined :style="{ fontSize: '20px' }" />
      </Badge>
    </SC_EventsWrapper>

    <template #overlay>
      <SC_PendingEventsMenu @click.stop @mousedown.stop>
        <SC_EmptyMessage v-if="pendingItems.length === 0">
          Нет активных событий
        </SC_EmptyMessage>
        <SC_EventsList v-else>
          <SC_EventItem v-for="item in pendingItems" :key="item.shareId" @click.stop @mousedown.stop>
            <SC_EventHeader>Оценка поста</SC_EventHeader>

            <SC_EventContent>
              <SC_PostTitle :title="item.postTitle || 'Без названия'">
                {{ truncateTitle(item.postTitle) }}
              </SC_PostTitle>

              <SC_RatingDisplay>
                <StarFilled :style="{ color: 'rgb(255, 193, 7)', fontSize: '18px', marginRight: '4px' }" />
                <SC_RatingValue>{{ item.ratingValue }}</SC_RatingValue>
              </SC_RatingDisplay>
            </SC_EventContent>
          </SC_EventItem>
        </SC_EventsList>
      </SC_PendingEventsMenu>
    </template>
  </Dropdown>
</template>

<script>
import { headerEventsOptions } from './header-events.ts'
import { StarFilled } from '@ant-design/icons-vue'
import {
  SC_PendingEventsMenu,
  SC_EmptyMessage,
  SC_EventsList,
  SC_EventItem,
  SC_EventHeader,
  SC_EventContent,
  SC_PostTitle,
  SC_RatingDisplay,
  SC_RatingValue
} from './styled.ts'

export default {
  ...headerEventsOptions,
  components: {
    ...headerEventsOptions.components,
    StarFilled,
    SC_PendingEventsMenu,
    SC_EmptyMessage,
    SC_EventsList,
    SC_EventItem,
    SC_EventHeader,
    SC_EventContent,
    SC_PostTitle,
    SC_RatingDisplay,
    SC_RatingValue
  },
  methods: {
    truncateTitle(title) {
      const t = title || 'Без названия'
      if (t.length <= 100) return t
      return t.slice(0, 100) + '...'
    }
  }
}
</script>
