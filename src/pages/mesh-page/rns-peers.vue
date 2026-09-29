<template>
  <SC_MeshCard>
    <SC_MeshCardHead>
      <SC_MeshCardTitle>
        {{ t('mesh.rns.peers.title') }}
        <SC_MeshCount>{{ contacts.length }}</SC_MeshCount>
      </SC_MeshCardTitle>
    </SC_MeshCardHead>

    <SC_MeshNote v-if="contacts.length === 0">{{ t('mesh.rns.peers.empty') }}</SC_MeshNote>
    <SC_MeshList v-else>
      <SC_MeshItem v-for="p in shown" :key="p.dest">
        <SC_MeshItemMain>
          <SC_MeshItemName>{{ p.name || p.dest.slice(0, 12) }}</SC_MeshItemName>
          <SC_MeshItemMeta>{{ describe(p) }}</SC_MeshItemMeta>
        </SC_MeshItemMain>
        <Button size="small" type="primary" @click="write(p.dest, p.name)">
          {{ t('mesh.contacts.write') }}
        </Button>
      </SC_MeshItem>
    </SC_MeshList>

    <SC_MeshSubtitle>{{ t('mesh.rns.peers.byAddress') }}</SC_MeshSubtitle>
    <SC_MeshNote>{{ t('mesh.rns.peers.byAddressHint') }}</SC_MeshNote>
    <SC_MeshForm @submit.prevent="writeByAddress">
      <SC_MeshField>
        <SC_MeshInput
          v-model="addressInput"
          :placeholder="t('mesh.rns.peers.addressPlaceholder')"
          autocomplete="off"
          spellcheck="false"
        />
      </SC_MeshField>
      <Button html-type="submit" :disabled="!addressValid">{{ t('mesh.contacts.write') }}</Button>
    </SC_MeshForm>
  </SC_MeshCard>
</template>

<script setup lang="ts">
/** Собеседники LXMF: кто объявился в сети, и написать по адресу. */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { Button } from 'ant-design-vue'
import { useMessengerStore } from '@/b-components/messenger/store'
import { useMeshChatStore } from '@/mesh/store/mesh-chat-store'
import { useReticulumStore, type RnsPeer } from '@/mesh/store/reticulum-store'
import {
  SC_MeshCard,
  SC_MeshCardHead,
  SC_MeshCardTitle,
  SC_MeshCount,
  SC_MeshField,
  SC_MeshForm,
  SC_MeshInput,
  SC_MeshItem,
  SC_MeshItemMain,
  SC_MeshItemMeta,
  SC_MeshItemName,
  SC_MeshList,
  SC_MeshNote,
  SC_MeshSubtitle,
} from './mesh-page.styled'

const { t } = useI18n()
const rns = useReticulumStore()
const { contacts, address } = storeToRefs(rns)
const shown = computed(() => contacts.value.slice(0, 50))

function describe(p: RnsPeer): string {
  const parts = [p.dest.slice(0, 12)]
  if (p.hops !== null) {
    parts.push(
      p.hops === 0 ? t('mesh.contacts.direct') : t('mesh.contacts.hops', { n: p.hops }, p.hops)
    )
  }
  return parts.join(' · ')
}

async function write(dest: string, name: string | null): Promise<void> {
  if (!address.value) return
  const id = await useMeshChatStore().ensureLxmfDialog(address.value, dest, name)
  const messenger = useMessengerStore()
  await messenger.openMessenger()
  await messenger.openChat(id)
}

const addressInput = ref('')
const addressValid = computed(() => /^[0-9a-f]{32}$/i.test(addressInput.value.trim()))

async function writeByAddress(): Promise<void> {
  if (!addressValid.value) return
  const dest = addressInput.value.trim().toLowerCase()
  addressInput.value = ''
  await write(dest, rns.peerName(dest))
}
</script>
