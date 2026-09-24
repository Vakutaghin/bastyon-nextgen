<template>
  <SC_Perms>
    <SC_PermsTitle>{{ t('settings.appPermissions.title') }}</SC_PermsTitle>
    <SC_PermsLead>{{ t('settings.appPermissions.lead') }}</SC_PermsLead>

    <SC_PermsState v-if="!permissionsStore.ready">
      {{ t('settings.appPermissions.loading') }}
    </SC_PermsState>

    <SC_PermsState v-else-if="apps.length === 0">
      {{ t('settings.appPermissions.empty') }}
    </SC_PermsState>

    <template v-else>
      <SC_AppCard v-for="app in apps" :key="app.appId">
        <SC_AppHead>
          <SC_AppIcon>
            <img v-if="app.icon" :src="app.icon" :alt="app.name" />
            <span v-else>{{ app.name.charAt(0).toUpperCase() }}</span>
          </SC_AppIcon>
          <SC_AppName>{{ app.name }}</SC_AppName>
          <SC_RevokeAllBtn type="button" @click="revokeAll(app.appId)">
            {{ t('settings.appPermissions.revokeAll') }}
          </SC_RevokeAllBtn>
          <!-- S51: сайдлоад-приложение можно было установить, но не удалить. -->
          <SC_DeleteAppBtn v-if="app.canDelete" type="button" @click="askRemove(app)">
            {{ t('miniapps.deleteApp') }}
          </SC_DeleteAppBtn>
        </SC_AppHead>

        <SC_PermRow v-for="grant in app.grants" :key="grant.permission">
          <SC_PermInfo>
            <SC_PermName>{{ permLabel(grant.permission) }}</SC_PermName>
            <SC_PermMeta>{{
              t('settings.appPermissions.grantedAt', { date: fmtDate(grant.grantedAt) })
            }}</SC_PermMeta>
          </SC_PermInfo>
          <SC_DeniedBadge v-if="grant.state === 'denied'">
            {{ t('settings.appPermissions.denied') }}
          </SC_DeniedBadge>
          <SC_RevokeBtn type="button" @click="revoke(app.appId, grant.permission)">
            {{ t('settings.appPermissions.revoke') }}
          </SC_RevokeBtn>
        </SC_PermRow>
      </SC_AppCard>
    </template>
  </SC_Perms>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Modal } from 'ant-design-vue'
import { usePermissionsStore } from '@/mini-apps/store/permissions-store'
import { useAppsStore } from '@/mini-apps/store/apps-store'
import { useFavoriteMiniAppsStore } from '@/mini-apps/store/favorites-store'
import type { PermissionId } from '@/mini-apps/types/permissions'
import {
  SC_Perms,
  SC_PermsTitle,
  SC_PermsLead,
  SC_PermsState,
  SC_AppCard,
  SC_AppHead,
  SC_AppIcon,
  SC_AppName,
  SC_PermRow,
  SC_PermInfo,
  SC_PermName,
  SC_PermMeta,
  SC_DeniedBadge,
  SC_RevokeBtn,
  SC_RevokeAllBtn,
  SC_DeleteAppBtn,
} from './app-permissions-tab.styled'

const { t, te, locale } = useI18n()
const permissionsStore = usePermissionsStore()
const appsStore = useAppsStore()

onMounted(() => {
  void permissionsStore.init()
})

const apps = computed(() =>
  Object.keys(permissionsStore.grants).map((appId) => {
    const installed = appsStore.byId(appId)
    return {
      appId,
      name: installed?.manifest.name || appId,
      icon: installed?.icon || '',
      grants: permissionsStore.forApp(appId),
      // Удалить можно только то, что пользователь добавил сам (S51).
      canDelete: installed?.source === 'local',
    }
  })
)

/** Человекочитаемое имя пермишена; фолбэк на сырой id, если перевода нет. */
function permLabel(id: PermissionId): string {
  const key = `appMsg.permission.${id}.name`
  return te(key) ? t(key) : id
}

function fmtDate(ts: number): string {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString(locale.value)
}

function revoke(appId: string, permission: PermissionId): void {
  void permissionsStore.revoke(appId, permission)
}

function revokeAll(appId: string): void {
  void permissionsStore.revokeAll(appId)
}

function askRemove(app: { appId: string; name: string }): void {
  Modal.confirm({
    title: t('miniapps.deleteConfirmTitle', { name: app.name }),
    content: t('miniapps.deleteConfirmContent'),
    okText: t('miniapps.deleteApp'),
    cancelText: t('miniapps.cancel'),
    okType: 'danger',
    centered: true,
    onOk: async () => {
      await appsStore.uninstall(app.appId)
      await useFavoriteMiniAppsStore().remove(app.appId)
    },
  })
}
</script>
