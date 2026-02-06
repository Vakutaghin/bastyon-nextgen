# Vue Query Composables

Этот модуль содержит composables для работы с RPC запросами через Vue Query (TanStack Query).

## Установка

Vue Query уже установлен и настроен в `main.js`. QueryClient настроен с оптимальными значениями по умолчанию.

## Основные composables

### `useRpcQuery`

Выполняет RPC запрос с автоматическим кэшированием.

```typescript
import { useRpcQuery } from '@/composables'

const { data, isLoading, error, refetch } = useRpcQuery<UserProfile>(
  ['user', 'profile', userId],
  {
    method: 'user.get',
    parameters: [userId],
    options: { auth: false }
  },
  {
    staleTime: 5 * 60 * 1000, // 5 минут
    enabled: !!userId, // Условный запрос
  }
)
```

### `useRpcQueryWithAuth`

Выполняет авторизованный RPC запрос с кэшированием.

```typescript
import { useRpcQueryWithAuth } from '@/composables'

const { data, isLoading } = useRpcQueryWithAuth<UserState>(
  ['user', 'state'],
  {
    method: 'user.getstate',
    parameters: [],
    options: { auth: true }
  }
)
```

### `useRpcMutation`

Выполняет мутацию (изменяющий запрос) с автоматической инвалидацией кэша.

```typescript
import { useRpcMutation } from '@/composables'

const { mutate, isPending, error } = useRpcMutation(
  {
    method: 'content.add',
    parameters: [contentData],
    options: { auth: true }
  },
  {
    invalidateQueries: [['feed'], ['user', 'profile']] // Инвалидируем эти запросы после успеха
  }
)

// Использование
mutate(undefined, {
  onSuccess: () => {
    console.info('Пост создан!')
  },
  onError: (error) => {
    console.error('Ошибка:', error)
  }
})
```

### `useRpcMutationWithAuth`

Выполняет авторизованную мутацию.

```typescript
import { useRpcMutationWithAuth } from '@/composables'

const { mutate } = useRpcMutationWithAuth(
  {
    method: 'content.like',
    parameters: [postId],
    options: { auth: true }
  },
  {
    invalidateQueries: [['feed', postId]]
  }
)
```

## Примеры использования в компонентах

### Пример 1: Загрузка данных пользователя

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useRpcQuery } from '@/composables'
import type { UserProfile } from '@/types/rpc-responses/user-get'

const p = defineProps<{
  userId: string
}>()

const { data: userProfile, isLoading, error } = useRpcQuery<UserProfile>(
  ['user', 'profile', p.userId],
  {
    method: 'user.get',
    parameters: [p.userId],
    options: { auth: false }
  },
  {
    enabled: computed(() => !!p.userId), // Запрос выполнится только если userId есть
    staleTime: 5 * 60 * 1000, // 5 минут
  }
)
</script>

<template>
  <div v-if="isLoading">Загрузка...</div>
  <div v-else-if="error">Ошибка: {{ error.message }}</div>
  <div v-else-if="userProfile">
    <h1>{{ userProfile.name }}</h1>
    <p>{{ userProfile.about }}</p>
  </div>
</template>
```

### Пример 2: Использование composable для ленты

```vue
<script setup lang="ts">
import { useHierarchicalStrip } from '@/composables/use-feed'

const { posts, isLoading, error, refetch } = useHierarchicalStrip(0, 20)

// Автоматическое обновление каждые 30 секунд
const { data } = useHierarchicalStrip(0, 20, true)
</script>

<template>
  <div v-if="isLoading">Загрузка постов...</div>
  <div v-else-if="error">Ошибка: {{ error.message }}</div>
  <div v-else>
    <div v-for="post in posts" :key="post.id">
      <h2>{{ post.title }}</h2>
      <p>{{ post.content }}</p>
    </div>
    <button @click="refetch()">Обновить</button>
  </div>
</template>
```

### Пример 3: Создание поста с инвалидацией кэша

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useRpcMutationWithAuth } from '@/composables'
import { useRouter } from 'vue-router'

const router = useRouter()
const content = ref('')

const { mutate: createPost, isPending } = useRpcMutationWithAuth(
  (variables) => ({
    method: 'content.add',
    parameters: [variables],
    options: { auth: true }
  }),
  {
    invalidateQueries: [['feed']] // Обновим ленту после создания поста
  }
)

function handleSubmit() {
  createPost(
    {
      type: 'post',
      content: content.value,
    },
    {
      onSuccess: () => {
        content.value = ''
        router.push('/feed')
      },
      onError: (error) => {
        alert('Ошибка создания поста: ' + error.message)
      }
    }
  )
}
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <textarea v-model="content" />
    <button type="submit" :disabled="isPending">
      {{ isPending ? 'Создание...' : 'Создать пост' }}
    </button>
  </form>
</template>
```

## Преимущества Vue Query

1. **Автоматическое кэширование** - одинаковые запросы не выполняются повторно
2. **Фоновое обновление** - данные обновляются в фоне при необходимости
3. **Deduplication** - несколько компонентов с одинаковым запросом = один реальный запрос
4. **Автоматическая инвалидация** - легко обновлять связанные данные
5. **Retry логика** - автоматические повторы при ошибках
6. **Оптимистичные обновления** - можно обновлять UI до получения ответа
7. **Пагинация и бесконечные списки** - встроенная поддержка

## Миграция с Pinia stores

Вместо:

```typescript
// feed-store.ts
async loadHierarchicalStrip(offset: number = 0, limit: number = 20) {
  this.loading = true
  try {
    const response = await getByPRC({...})
    this.feedData = response
  } catch (err) {
    this.error = err.message
  } finally {
    this.loading = false
  }
}
```

Используйте:

```typescript
// В компоненте
const { data, isLoading, error } = useHierarchicalStrip(offset, limit)
```

Или создайте composable для более сложной логики.

## Дополнительные возможности

### Условные запросы

```typescript
const { data } = useRpcQuery(
  ['user', userId],
  { method: 'user.get', parameters: [userId] },
  { enabled: !!userId && isAuthenticated.value }
)
```

### Автоматическое обновление

```typescript
const { data } = useRpcQuery(
  ['notifications'],
  { method: 'notifications.get', parameters: [] },
  {
    refetchInterval: 30000, // Обновлять каждые 30 секунд
    refetchOnWindowFocus: true, // Обновлять при фокусе окна
  }
)
```

### Ручная инвалидация

```typescript
import { useQueryClient } from '@tanstack/vue-query'

const queryClient = useQueryClient()

// Инвалидировать конкретный запрос
queryClient.invalidateQueries({ queryKey: ['feed'] })

// Инвалидировать все запросы с префиксом
queryClient.invalidateQueries({ queryKey: ['user'] })
```

### Оптимистичные обновления

```typescript
const { mutate } = useRpcMutationWithAuth(
  { method: 'content.like', parameters: [postId] },
  {
    onMutate: async (variables) => {
      // Отменяем текущие запросы
      await queryClient.cancelQueries({ queryKey: ['feed', postId] })
      
      // Сохраняем предыдущее значение
      const previousData = queryClient.getQueryData(['feed', postId])
      
      // Оптимистично обновляем
      queryClient.setQueryData(['feed', postId], (old: any) => ({
        ...old,
        likes: old.likes + 1
      }))
      
      return { previousData }
    },
    onError: (err, variables, context) => {
      // Откатываем при ошибке
      queryClient.setQueryData(['feed', postId], context.previousData)
    },
    onSettled: () => {
      // Обновляем после завершения
      queryClient.invalidateQueries({ queryKey: ['feed', postId] })
    }
  }
)
```
