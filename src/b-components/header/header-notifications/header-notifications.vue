<template>
  <Dropdown
    v-if="isAuthenticated"
    v-model:open="visible"
    :trigger="['click']"
    placement="bottomRight"
    :getPopupContainer="(trigger) => trigger.closest('header') || document.body"
    @openChange="onOpenChange"
  >
    <SC_NotificationsWrapper>
      <Badge
        :count="unreadCount"
        :offset="[0, 5]"
        :number-style="{ backgroundColor: '#1890ff' }"
      >
        <BellOutlined :style="{ fontSize: '20px' }" />
      </Badge>
    </SC_NotificationsWrapper>

    <template #overlay>
      <SC_NotificationsMenu @click.stop @mousedown.stop>
        <SC_NotificationsHeader>
          <SC_NotificationsTitle>Уведомления</SC_NotificationsTitle>
          <SC_NotificationsHeaderActions v-if="list.length > 0">
            <SC_ClearAllButton type="button" @click.stop="onClearAll">
              Убрать все
            </SC_ClearAllButton>
          </SC_NotificationsHeaderActions>
        </SC_NotificationsHeader>

        <SC_LoaderWrap v-if="isLoading">
          Загрузка...
        </SC_LoaderWrap>
        <SC_EmptyMessage v-else-if="list.length === 0">
          Нет новых уведомлений
        </SC_EmptyMessage>
        <SC_NotificationsList v-else>
          <SC_NotificationItem
            v-for="item in list"
            :key="item.id"
            :$seen="isSeen(item)"
          >
            <SC_NotificationItemBody @click="onItemClick(item)">
              <SC_NotificationItemTitle>{{ item.title }}</SC_NotificationItemTitle>
              <SC_NotificationItemDesc v-if="item.description">
                {{ item.description }}
              </SC_NotificationItemDesc>
              <SC_NotificationItemTime>{{ formatTime(item) }}</SC_NotificationItemTime>
            </SC_NotificationItemBody>
            <SC_NotificationItemActions @click.stop>
              <Dropdown
                trigger="click"
                placement="bottomRight"
                :getPopupContainer="(trigger) => trigger?.closest?.('.ant-dropdown') || document.body"
              >
                <SC_NotificationItemTrigger><EllipsisOutlined /></SC_NotificationItemTrigger>
                <template #overlay>
                  <Menu
                    :items="[{ key: item.id, label: 'Скрыть уведомление' }]"
                    @click="onItemMenuClick"
                  />
                </template>
              </Dropdown>
            </SC_NotificationItemActions>
          </SC_NotificationItem>
        </SC_NotificationsList>
      </SC_NotificationsMenu>
    </template>
  </Dropdown>
</template>

<script>
import { headerNotificationsOptions } from './header-notifications.ts'
import {
  SC_NotificationsWrapper,
  SC_NotificationsMenu,
  SC_NotificationsHeader,
  SC_NotificationsTitle,
  SC_NotificationsHeaderActions,
  SC_ClearAllButton,
  SC_NotificationsList,
  SC_NotificationItem,
  SC_NotificationItemBody,
  SC_NotificationItemActions,
  SC_NotificationItemTrigger,
  SC_NotificationItemTitle,
  SC_NotificationItemDesc,
  SC_NotificationItemTime,
  SC_EmptyMessage,
  SC_LoaderWrap
} from './styled.ts'

export default {
  ...headerNotificationsOptions,
  components: {
    ...headerNotificationsOptions.components,
    SC_NotificationsWrapper,
    SC_NotificationsMenu,
    SC_NotificationsHeader,
    SC_NotificationsTitle,
    SC_NotificationsHeaderActions,
    SC_ClearAllButton,
    SC_NotificationsList,
    SC_NotificationItem,
    SC_NotificationItemBody,
    SC_NotificationItemActions,
    SC_NotificationItemTrigger,
    SC_NotificationItemTitle,
    SC_NotificationItemDesc,
    SC_NotificationItemTime,
    SC_EmptyMessage,
    SC_LoaderWrap
  }
}
</script>
