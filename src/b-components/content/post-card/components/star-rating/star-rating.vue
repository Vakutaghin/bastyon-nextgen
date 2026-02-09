<template>
  <a-popover v-model:open="authPopoverVisible" trigger="click" placement="bottom">
    <template #content>
      <SC_AuthPopoverContent>
        <p>Войдите или зарегистрируйтесь, чтобы оценивать посты</p>
        <a-button type="primary" size="small" @click="openAuthModal">Войти</a-button>
      </SC_AuthPopoverContent>
    </template>
    <!-- Обертка для перехвата событий до того, как они дойдут до popover -->
    <div style="display: inline-block" @click.capture="handleRatingClick">
      <SC_StarRating class='star-rating'>
        <template v-for='n in 5' :key='`star-${n}`'>
          <SC_StarWrapper
            :class="{ disabled: disabled || isSubmitting, readonly: hasVoted }"
            @mouseenter='handleStarHover(n)'
            @mouseleave='handleStarLeave'
            @click='(e) => handleStarClick(n, e)'
          >
            <!-- Пустая контурная звезда (фон) - всегда показывается -->
            <StarOutlined class='star-bg' :style="{ color: 'rgba(255, 193, 7, 0.3)' }" />

            <!-- Полностью заполненная звезда -->
            <SC_StarFilled v-if='displayRating >= n'>
              <StarFilled class='star-fill' :style="{ color: 'rgb(255, 193, 7)' }" />
            </SC_StarFilled>
          </SC_StarWrapper>
        </template>

        <span class='star-count'>({{ optimisticAverageRating.toFixed(1) }})</span>
        <span class='voters-count'>
          <UserOutlined />
          {{ optimisticVotersCount }}
        </span>
      </SC_StarRating>
    </div>
  </a-popover>
</template>

<script>
import { starRatingOptions } from './star-rating.ts'
import { StarOutlined, StarFilled, UserOutlined } from '@ant-design/icons-vue'
import { Popover, Button } from 'ant-design-vue'
import {
  SC_AuthPopoverContent,
  SC_StarRating,
  SC_StarWrapper,
  SC_StarFilled
} from './styled'

export default {
  ...starRatingOptions,
  components: {
    StarOutlined,
    StarFilled,
    UserOutlined,
    SC_AuthPopoverContent,
    SC_StarRating,
    SC_StarWrapper,
    SC_StarFilled,
    APopover: Popover,
    AButton: Button
  }
}
</script>
