<template>
  <DevUiSection title="Tooltip, Popover, Dropdown">
    <SC_DevUiRow>
      <SC_DevUiRowLabel>Tooltip</SC_DevUiRowLabel>
      <Tooltip v-for="side in SIDES" :key="side" :title="`Подсказка: ${side}`" :placement="side">
        <Button size="small" :data-testid="`dev-tip-${side}`">{{ side }}</Button>
      </Tooltip>
      <Tooltip :title="LONG" :trigger="['hover', 'focus', 'click']">
        <Button size="small" aria-label="Справка" data-testid="dev-tip-click">
          <template #icon><InfoCircleOutlined /></template>
        </Button>
      </Tooltip>
    </SC_DevUiRow>
    <SC_DevUiRow>
      <SC_DevUiRowLabel>Popover</SC_DevUiRowLabel>
      <Popover title="Проверен" placement="bottom">
        <template #content>
          <p>Аккаунт подтвердил владелец.</p>
          <Button size="small" type="link" data-testid="dev-pop-more">Подробнее</Button>
        </template>
        <Button size="small" data-testid="dev-pop-click">по нажатию</Button>
      </Popover>
      <Popover :trigger="['hover', 'click']" :mouse-enter-delay="0.2">
        <template #content>Определение термина: по наведению и нажатию.</template>
        <Button size="small" data-testid="dev-pop-hover">наведение</Button>
      </Popover>
      <Popconfirm
        title="Покинуть группу?"
        description="Вы перестанете получать сообщения."
        ok-text="Покинуть"
        cancel-text="Отмена"
        danger
        placement="bottom"
        @confirm="confirmed += 1"
      >
        <Button size="small" data-testid="dev-popconfirm">Popconfirm ({{ confirmed }})</Button>
      </Popconfirm>
    </SC_DevUiRow>
    <SC_DevUiRow>
      <SC_DevUiRowLabel>Dropdown</SC_DevUiRowLabel>
      <Dropdown placement="bottomLeft">
        <Button size="small" data-testid="dev-dropdown">меню: {{ picked }}</Button>
        <template #overlay>
          <Menu :items="MENU" @click="({ key }) => (picked = key)" />
        </template>
      </Dropdown>
    </SC_DevUiRow>
  </DevUiSection>
</template>

<script setup lang="ts">
// Плавающие панели: подсказка по наведению и фокусу, справка по нажатию,
// панель у кнопки, подтверждение.
import { h, ref } from 'vue'
import Button from '@/components/button'
import Dropdown from '@/components/dropdown'
import Menu, { type MenuItem } from '@/components/menu'
import Popconfirm from '@/components/popconfirm'
import Popover from '@/components/popover'
import Tooltip from '@/components/tooltip'
import { DeleteOutlined, EditOutlined, InfoCircleOutlined, LockOutlined } from '@/components/icons'
import DevUiSection from '../dev-ui-section.vue'
import { SC_DevUiRow, SC_DevUiRowLabel } from '../dev-ui-page.styled'

const confirmed = ref(0)
const picked = ref('—')

const MENU: MenuItem[] = [
  { key: 'edit', label: 'Изменить', icon: () => h(EditOutlined) },
  { key: 'left', label: 'Осталось правок: 3 из 5', disabled: true },
  { key: 'private', label: 'Сделать личной', icon: () => h(LockOutlined) },
  { type: 'divider' },
  { key: 'delete', label: 'Удалить', icon: () => h(DeleteOutlined), danger: true },
]

const SIDES = ['top', 'bottom', 'left', 'right'] as const

const LONG =
  'Справка по нажатию: на телефоне подсказка открывается касанием и закрывается касанием мимо.'
</script>
