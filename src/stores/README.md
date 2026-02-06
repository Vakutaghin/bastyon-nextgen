# Глобальные Pinia Stores

Эта папка содержит глобальные Pinia stores, которые используются несколькими компонентами.

## Структура

- Каждый store должен быть в отдельном файле с логичным именем
- Имя файла должно отражать назначение стора (например: `user-store.js`, `feed-store.js`)
- Импортируйте сторы там, где они нужны

## Пример использования

```javascript
import { useUserStore } from '@/stores/user-store'

export default {
  setup() {
    const userStore = useUserStore()
    return { userStore }
  }
}
```

## Локальные сторы

Если стор нужен только одному компоненту, создайте файл `store.js` рядом с компонентом.
