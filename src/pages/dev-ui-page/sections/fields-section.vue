<template>
  <DevUiSection title="Input, InputSearch, TextArea">
    <SC_DevUiRow>
      <SC_DevUiRowLabel>Input</SC_DevUiRowLabel>
      <SC_DevUiStack>
        <Input v-model:value="text" placeholder="Подсказка в поле" aria-label="Обычное" />
        <Input v-model:value="filter" allow-clear placeholder="Фильтр" aria-label="С крестиком">
          <template #prefix><SearchOutlined /></template>
        </Input>
        <Input v-model:value="secret" type="password" allow-clear aria-label="Пароль" />
      </SC_DevUiStack>
    </SC_DevUiRow>
    <SC_DevUiRow>
      <SC_DevUiRowLabel>Состояния</SC_DevUiRowLabel>
      <SC_DevUiStack>
        <Input v-model:value="title" show-count :maxlength="120" aria-label="Со счётчиком" />
        <Input value="Неверный адрес" status="error" aria-label="Ошибка" />
        <Input value="Проверьте адрес" status="warning" aria-label="Предупреждение" />
        <Input value="Нельзя менять" disabled aria-label="Выключено" />
        <Input value="https://bastyon.com/p/abc" readonly aria-label="Только чтение" />
      </SC_DevUiStack>
    </SC_DevUiRow>
    <SC_DevUiRow>
      <SC_DevUiRowLabel>InputSearch</SC_DevUiRowLabel>
      <SC_DevUiStack>
        <InputSearch
          v-model:value="query"
          placeholder="Поиск по сайту"
          allow-clear
          @search="(v: string) => (searched = v)"
        />
        <InputSearch value="идёт поиск" loading placeholder="Поиск" />
        <SC_DevUiRowLabel>Последний поиск: «{{ searched }}»</SC_DevUiRowLabel>
      </SC_DevUiStack>
    </SC_DevUiRow>
    <SC_DevUiRow>
      <SC_DevUiRowLabel>TextArea</SC_DevUiRowLabel>
      <SC_DevUiStack>
        <TextArea
          v-model:value="note"
          :auto-size="{ minRows: 3, maxRows: 6 }"
          placeholder="Растёт от 3 до 6 строк"
          aria-label="Автовысота"
        />
        <TextArea
          v-model:value="description"
          :auto-size="{ minRows: 2, maxRows: 8 }"
          show-count
          :maxlength="500"
          status="error"
          aria-label="Со счётчиком и ошибкой"
        />
      </SC_DevUiStack>
    </SC_DevUiRow>
  </DevUiSection>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Input from '@/components/input'
import InputSearch from '@/components/input-search'
import TextArea from '@/components/textarea'
import { SearchOutlined } from '@/components/icons'
import DevUiSection from '../dev-ui-section.vue'
import { SC_DevUiRow, SC_DevUiRowLabel, SC_DevUiStack } from '../dev-ui-page.styled'

const text = ref('')
const filter = ref('')
const secret = ref('secret123')
const title = ref('Название ролика')
const query = ref('')
const searched = ref('')
const note = ref('')
const description = ref('Описание ролика: проверьте перенос длинного текста по ширине поля.')
</script>
