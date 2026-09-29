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
        <Button size="small" type="primary" @click="writeToLxmf(p.dest, p.name)">
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

    <SC_MeshSubtitle>{{ t('mesh.rns.paper.title') }}</SC_MeshSubtitle>
    <SC_MeshNote>{{ t('mesh.rns.paper.hint') }}</SC_MeshNote>
    <SC_MeshForm @submit.prevent="openPaper(paperInput)">
      <SC_MeshField>
        <SC_MeshInput
          v-model="paperInput"
          placeholder="lxm://…"
          autocomplete="off"
          spellcheck="false"
        />
      </SC_MeshField>
      <Button html-type="submit" :disabled="!paperValid">{{ t('mesh.rns.paper.open') }}</Button>
      <Button @click="scanning = !scanning">{{ t('mesh.rns.paper.scan') }}</Button>
    </SC_MeshForm>
    <QrScanner v-if="scanning" @decoded="onScanned" />
  </SC_MeshCard>
</template>

<script setup lang="ts">
/**
 * Собеседники LXMF: кто объявился в сети, написать по адресу, открыть
 * бумажное сообщение (ссылка `lxm://` или её QR-код).
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { Button } from 'ant-design-vue'
import QrScanner from '@/b-components/qr-scanner/qr-scanner.vue'
import { rnsIngest } from '@/mesh/reticulum/rns-api'
import { useReticulumStore } from '@/mesh/store/reticulum-store'
import { useMeshAction, useMeshOpenChat, useRnsPeerMeta } from './use-mesh-page'
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
const { contacts } = storeToRefs(rns)
const shown = computed(() => contacts.value.slice(0, 50))
const describe = useRnsPeerMeta()
const { writeToLxmf } = useMeshOpenChat()

const addressInput = ref('')
const addressValid = computed(() => /^[0-9a-f]{32}$/i.test(addressInput.value.trim()))

const act = useMeshAction()
const paperInput = ref('')
const paperValid = computed(() => /^lxm:\/\/[\w\-/]+=*$/i.test(paperInput.value.trim()))
const scanning = ref(false)

async function openPaper(uri: string): Promise<void> {
  if (await act(() => rnsIngest(uri.trim()), t('mesh.rns.paper.done'))) paperInput.value = ''
}

function onScanned(text: string): void {
  scanning.value = false
  void openPaper(text)
}

async function writeByAddress(): Promise<void> {
  if (!addressValid.value) return
  const dest = addressInput.value.trim().toLowerCase()
  addressInput.value = ''
  await writeToLxmf(dest, rns.peerName(dest))
}
</script>
