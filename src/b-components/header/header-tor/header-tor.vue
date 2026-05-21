<template>
  <Dropdown
    v-model:open="visible"
    :trigger="['click']"
    placement="bottomRight"
    :overlay-style="{ zIndex: 3000 }"
  >
    <SC_TorWrapper :variant="variant" @click="onTriggerClick">
      <CheckCircleFilled
        v-if="variant === 'ready'"
        :style="{ fontSize: '20px' }"
      />
      <LoadingOutlined
        v-else-if="variant === 'busy'"
        :style="{ fontSize: '20px' }"
        spin
      />
      <WarningFilled
        v-else-if="variant === 'failed'"
        :style="{ fontSize: '20px' }"
      />
      <SafetyOutlined v-else :style="{ fontSize: '20px' }" />
    </SC_TorWrapper>

    <template #overlay>
      <SC_TorMenu @click.stop @mousedown.stop>
        <SC_TorRow>
          <SC_TorTitle>Tor</SC_TorTitle>
          <Switch :checked="enabled" :disabled="!available" @click="onToggleSwitch" />
        </SC_TorRow>

        <SC_TorStatusLine>{{ statusLine }}</SC_TorStatusLine>

        <SC_TorProgressOuter v-if="showProgress">
          <SC_TorProgressInner :pct="progressPct" />
        </SC_TorProgressOuter>

        <SC_TorBridgeBlock>
          <SC_TorTitle style="font-size: 12px">Мосты</SC_TorTitle>
          <RadioGroup :value="localKind" @change="(e: any) => onSelectKind(e.target.value)">
            <Radio value="none">Без мостов</Radio>
            <Radio value="snowflake">Snowflake</Radio>
            <Radio value="obfs4">OBFS4 (встроенные)</Radio>
            <Radio value="custom">Свои OBFS4</Radio>
          </RadioGroup>
          <SC_TorTextarea
            v-if="localKind === 'custom'"
            :value="localCustom"
            placeholder="obfs4 IP:PORT FINGERPRINT cert=... iat-mode=..."
            @input="(e: any) => onCustomInput(e.target.value)"
          />
          <SC_TorActions>
            <Button size="small" type="primary" :disabled="!dirty" @click="onApplyBridges">
              Применить
            </Button>
          </SC_TorActions>
          <SC_TorHint>
            Изменение мостов перезапустит Tor.
          </SC_TorHint>
        </SC_TorBridgeBlock>

        <SC_TorHint v-if="!available">
          Доступно только в десктопном приложении.
        </SC_TorHint>
      </SC_TorMenu>
    </template>
  </Dropdown>
</template>

<script>
import { Dropdown, Switch, Radio, Button } from 'ant-design-vue'
import { headerTorOptions } from './header-tor.ts'
import {
  SC_TorWrapper,
  SC_TorMenu,
  SC_TorRow,
  SC_TorTitle,
  SC_TorStatusLine,
  SC_TorProgressOuter,
  SC_TorProgressInner,
  SC_TorBridgeBlock,
  SC_TorTextarea,
  SC_TorActions,
  SC_TorHint,
} from './styled.ts'

const RadioGroup = Radio.Group

export default {
  ...headerTorOptions,
  components: {
    ...headerTorOptions.components,
    Dropdown,
    Switch,
    Radio,
    RadioGroup,
    Button,
    SC_TorWrapper,
    SC_TorMenu,
    SC_TorRow,
    SC_TorTitle,
    SC_TorStatusLine,
    SC_TorProgressOuter,
    SC_TorProgressInner,
    SC_TorBridgeBlock,
    SC_TorTextarea,
    SC_TorActions,
    SC_TorHint,
  },
}
</script>
