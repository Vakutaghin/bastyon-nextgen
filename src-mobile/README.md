# Мобильная версия приложения

## Подход

**Capacitor = WebView + нативные плагины**

## Использование

### Определение платформы

```typescript
import { getPlatform, isMobile, isNative } from '@mobile/utils'

const platform = getPlatform() // 'web' | 'tauri' | 'capacitor-ios' | 'capacitor-android'
const isMobileDevice = isMobile() // true для iOS/Android
```

### Использование нативных API (только когда нужно)

```typescript
import { getPhoto } from '@mobile/adapters'

// В компоненте
const pickImage = async () => {
  if (isMobile()) {
    // Используем нативную камеру
    const image = await getPhoto()
  } else {
    // Используем обычный input
    inputRef.value.click()
  }
}
```

## Что работает в WebView без изменений

- ✅ localStorage
- ✅ fetch/XMLHttpRequest
- ✅ IndexedDB
- ✅ Canvas/WebGL
- ✅ Все веб-API

## Когда использовать Capacitor плагины

Используйте нативные плагины только когда это улучшает UX:

- 📷 **Camera** - лучше чем `<input type="file">` на мобильных
- 📁 **File System** - для работы с файлами устройства
- 📤 **Share** - для функционала "поделиться"
- 🔔 **Push Notifications** - для уведомлений
- 🔋 **Status Bar** - для управления статус-баром

## Принцип

**Минималистичный подход:**
- Веб-приложение работает как есть
- Добавляем мобильные адаптации только там, где это улучшает UX
- Используем условный рендеринг вместо дублирования кода
