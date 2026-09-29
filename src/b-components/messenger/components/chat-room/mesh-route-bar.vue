<template>
  <SC_MeshRouteBar role="status">
    <SC_MeshRouteText>📡 {{ text }}</SC_MeshRouteText>
    <SC_MeshRouteAction v-if="action" type="button" @click="action.run">
      {{ action.label }}
    </SC_MeshRouteAction>
  </SC_MeshRouteBar>
</template>

<script setup lang="ts">
/**
 * Mesh-маршрут собеседника в обычном чате: через что уйдёт сообщение и как
 * это поменять. Сервер чатов недоступен — через Reticulum сам; на связи —
 * можно выбрать Reticulum вручную. Узел не запущен — предложить запустить.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import type { ActiveMeshRoute } from '../../store/messenger-store/use-mesh-routes'
import { SC_MeshRouteAction, SC_MeshRouteBar, SC_MeshRouteText } from './mesh-route-bar.styled'

const props = defineProps<{ route: ActiveMeshRoute }>()
const emit = defineEmits<{ toggle: [] }>()

const { t } = useI18n()
const router = useRouter()

const text = computed<string>(() => {
  const r = props.route
  if (r.viaMesh) return r.online ? t('mesh.route.forced') : t('mesh.route.offline')
  if (!r.meshId) return r.online ? t('mesh.route.available') : t('mesh.route.offlineNoNode')
  return r.online ? t('mesh.route.available') : t('mesh.route.offlineNoPath')
})

const action = computed<{ label: string; run: () => void } | null>(() => {
  const r = props.route
  if (!r.meshId) {
    return {
      label: t('mesh.route.startNode'),
      run: () => void router.push({ path: '/mesh', query: { net: 'reticulum' } }),
    }
  }
  if (r.viaMesh && r.forced && r.online) {
    return { label: t('mesh.route.useServer'), run: () => emit('toggle') }
  }
  if (!r.viaMesh && r.online) return { label: t('mesh.route.useMesh'), run: () => emit('toggle') }
  return null
})
</script>
