<template>
  <Tooltip v-if="isVisible" title="Сообщить об ошибке" placement="bottom">
    <SC_ReportBugWrapper @click="onClick">
      <BugOutlined :style="{ fontSize: '20px' }" />
    </SC_ReportBugWrapper>
  </Tooltip>
</template>

<script>
import { headerReportBugOptions } from './header-report-bug.ts'

export default headerReportBugOptions
</script>
