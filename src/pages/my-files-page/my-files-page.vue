<template>
  <SC_FilesWork>
    <SC_FilesPage>
      <SC_FilesHead>
        <SC_FilesTitle>{{ t('myFiles.title') }}</SC_FilesTitle>
        <SC_FilesActions v-if="files.available">
          <Button type="primary" :loading="sharing" @click="files.share('public')">
            {{ t('myFiles.share') }}
          </Button>
          <Button :disabled="sharing" @click="files.share('private')">
            {{ t('myFiles.sharePrivately') }}
          </Button>
        </SC_FilesActions>
      </SC_FilesHead>

      <SC_FilesNote v-if="!files.available">{{ t('myFiles.desktopOnly') }}</SC_FilesNote>

      <template v-else>
        <SC_FilesStatus>
          <SC_FilesStatusText>
            <SC_FilesDot :state="node" />
            <span>{{ t(`myFiles.node.${node}`) }}</span>
          </SC_FilesStatusText>
          <Button v-if="node === 'stopped'" size="small" @click="files.startNode()">
            {{ t('myFiles.startNode') }}
          </Button>
        </SC_FilesStatus>

        <SC_FilesNote>
          {{ t(remoteConfigured ? 'myFiles.leadRemote' : 'myFiles.lead') }}
          <SC_FilesLinkButton type="button" @click="files.openRemoteSettings()">
            {{ t(remoteConfigured ? 'myFiles.remoteSettings' : 'myFiles.remoteSetup') }}
          </SC_FilesLinkButton>
        </SC_FilesNote>

        <SC_FilesNote v-if="loading">{{ t('myFiles.loading') }}</SC_FilesNote>
        <SC_FilesEmpty v-else-if="list.length === 0">{{ t('myFiles.empty') }}</SC_FilesEmpty>
        <SC_FilesList v-else>
          <SC_FilesRow v-for="file in list" :key="file.cid">
            <SC_FilesIcon>
              <LockOutlined v-if="file.key" />
              <FileOutlined v-else />
            </SC_FilesIcon>
            <SC_FilesMain>
              <SC_FilesName :title="file.name">{{ file.name }}</SC_FilesName>
              <SC_FilesMeta>
                <span>{{ describe(file) }}</span>
                <SC_FilesRemote
                  v-if="files.remoteStatus(file)"
                  :status="files.remoteStatus(file) ?? undefined"
                >
                  {{ t(`myFiles.remote.${files.remoteStatus(file)}`) }}
                </SC_FilesRemote>
              </SC_FilesMeta>
            </SC_FilesMain>
            <SC_FilesRowActions>
              <Button
                v-if="remoteConfigured && !files.remoteStatus(file)"
                size="small"
                @click="files.sendToService(file)"
              >
                {{ t('myFiles.sendToService') }}
              </Button>
              <Button size="small" @click="files.copyLink(file)">
                {{ t('myFiles.copyLink') }}
              </Button>
              <Button size="small" danger @click="files.confirmUnshare(file)">
                {{ t('myFiles.unshare') }}
              </Button>
            </SC_FilesRowActions>
          </SC_FilesRow>
        </SC_FilesList>
      </template>
    </SC_FilesPage>
  </SC_FilesWork>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Button } from 'ant-design-vue'
import { FileOutlined, LockOutlined } from '@/components/icons'
import { formatFileSize } from '@/b-components/messenger/components/file-message/helpers'
import { formatLongDate } from '@/helpers/common/date-formatter'
import type { IpfsShare } from '@/stores/ipfs-store'
import { useMyFiles } from './use-my-files'
import {
  SC_FilesWork,
  SC_FilesPage,
  SC_FilesHead,
  SC_FilesTitle,
  SC_FilesActions,
  SC_FilesStatus,
  SC_FilesStatusText,
  SC_FilesDot,
  SC_FilesNote,
  SC_FilesLinkButton,
  SC_FilesEmpty,
  SC_FilesList,
  SC_FilesRow,
  SC_FilesIcon,
  SC_FilesMain,
  SC_FilesName,
  SC_FilesMeta,
  SC_FilesRemote,
  SC_FilesRowActions,
} from './my-files-page.styled'

const { t } = useI18n()
const files = useMyFiles()
const { loading, sharing } = files
const node = files.node
const remoteConfigured = files.remoteConfigured
const list = files.files

function describe(file: IpfsShare): string {
  const access = t(file.key ? 'myFiles.private' : 'myFiles.public')
  return `${formatFileSize(file.size)} · ${formatLongDate(file.addedAt)} · ${access}`
}
</script>
