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
 * Mesh-маршруты собеседника в обычном чате: через что уйдёт сообщение и как
 * это поменять. Сервер чатов недоступен — через mesh-сеть сам (первую
 * готовую: Reticulum, MeshCore, Meshtastic); на связи — можно выбрать mesh
 * вручную. Ни одна сеть не готова — предложить открыть страницу mesh-сетей.
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
  if (r.viaMesh && r.net) {
    const net = t(`mesh.networks.${r.net}`)
    return r.online ? t('mesh.route.forced', { net }) : t('mesh.route.offline', { net })
  }
  return r.online ? t('mesh.route.available') : t('mesh.route.offlineNoNode')
})

const action = computed<{ label: string; run: () => void } | null>(() => {
  const r = props.route
  if (!r.meshId) {
    const net = r.nets[0] === 'lxmf' || !r.nets[0] ? 'reticulum' : r.nets[0]
    return {
      label: t('mesh.route.startNode'),
      run: () => void router.push({ path: '/mesh', query: { net } }),
    }
  }
  if (r.viaMesh && r.forced && r.online) {
    return { label: t('mesh.route.useServer'), run: () => emit('toggle') }
  }
  if (!r.viaMesh && r.online) return { label: t('mesh.route.useMesh'), run: () => emit('toggle') }
  return null
})
</script>
