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

        <template v-if="permanent.length">
          <SC_FilesSubtitle>{{ t('myFiles.permanent.section') }}</SC_FilesSubtitle>
          <SC_FilesList>
            <SC_FilesRow v-for="entry in permanent" :key="entry.name">
              <SC_FilesIcon>
                <LinkIcon />
              </SC_FilesIcon>
              <SC_FilesMain>
                <SC_FilesName :title="files.targetOf(entry)">{{
                  files.targetOf(entry)
                }}</SC_FilesName>
                <SC_FilesMeta>
                  <span :title="buildNameLink(entry.name)">{{ shortLink(entry.name) }}</span>
                  <span>·</span>
                  <span>{{
                    t('myFiles.permanent.updatedAt', { date: formatLongDate(entry.updatedAt) })
                  }}</span>
                  <SC_FilesRemote v-if="!files.targetShared(entry)" status="failed">
                    {{ t('myFiles.permanent.notShared') }}
                  </SC_FilesRemote>
                </SC_FilesMeta>
              </SC_FilesMain>
              <SC_FilesRowActions>
                <Button size="small" @click="files.copyPermanent(entry)">
                  {{ t('myFiles.copyLink') }}
                </Button>
                <Button size="small" @click="dialog = entry">
                  {{ t('myFiles.permanent.update') }}
                </Button>
              </SC_FilesRowActions>
            </SC_FilesRow>
          </SC_FilesList>
          <SC_FilesSubtitle>{{ t('myFiles.filesSection') }}</SC_FilesSubtitle>
        </template>

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
                v-if="files.canSendToService(file)"
                size="small"
                @click="files.sendToService(file)"
              >
                {{ t('myFiles.sendToService') }}
              </Button>
              <Button size="small" @click="files.copyLink(file)">
                {{ t('myFiles.copyLink') }}
              </Button>
              <Button
                v-if="!file.key"
                size="small"
                :disabled="naming"
                @click="files.openPermanent(file)"
              >
                {{ t('myFiles.permanent.make') }}
              </Button>
              <Button size="small" danger @click="files.confirmUnshare(file)">
                {{ t('myFiles.unshare') }}
              </Button>
            </SC_FilesRowActions>
          </SC_FilesRow>
        </SC_FilesList>
      </template>
    </SC_FilesPage>

    <PermanentLinkDialog
      :entry="dialog"
      :target="dialog ? files.targetOf(dialog) : ''"
      :files="publicFiles"
      :busy="naming"
      @close="dialog = null"
      @copy="dialog && files.copyPermanent(dialog)"
      @point="(file) => dialog && files.pointPermanent(dialog, file)"
    />
  </SC_FilesWork>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Button } from 'ant-design-vue'
import { FileOutlined, LinkIcon, LockOutlined } from '@/components/icons'
import { formatFileSize } from '@/b-components/messenger/components/file-message/helpers'
import { formatLongDate } from '@/helpers/common/date-formatter'
import { buildNameLink } from '@/helpers/ipfs/ipfs-viewer'
import type { IpfsShare } from '@/stores/ipfs-store'
import PermanentLinkDialog from './permanent-link-dialog.vue'
import { useMyFiles } from './use-my-files'
import {
  SC_FilesWork,
  SC_FilesPage,
  SC_FilesHead,
  SC_FilesTitle,
  SC_FilesSubtitle,
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
const { permanent, dialog, naming, publicFiles } = files

/** `ipns://k51qzi5u…amfwc`: имя целиком видно в подсказке. */
function shortLink(name: string): string {
  return buildNameLink(`${name.slice(0, 10)}…${name.slice(-6)}`)
}

function describe(file: IpfsShare): string {
  const access = t(
    file.received ? 'myFiles.received' : file.key ? 'myFiles.private' : 'myFiles.public'
  )
  return `${formatFileSize(file.size)} · ${formatLongDate(file.addedAt)} · ${access}`
}
</script>
