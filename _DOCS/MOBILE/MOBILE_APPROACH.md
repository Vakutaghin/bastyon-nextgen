# Правильный подход к мобильной интеграции

## Основная идея

Capacitor = WebView + нативные плагины (как Cordova)

**Веб-приложение в `src/` работает как есть в WebView!**

## Что нужно, а что нет

### ❌ НЕ нужно:
- Отдельная точка входа (`src-mobile/main.ts`)
- Отдельный корневой компонент (`src-mobile/app.vue`)
- Дублирование кода
- Отдельные hooks для базовых вещей
- Адаптеры для localStorage (работает в WebView)

### ✅ НУЖНО только:
1. **Мобильные UI компоненты** (если нужны специфичные элементы):
   - Bottom navigation
   - Mobile drawer
   - Touch-оптимизированные компоненты

2. **Адаптеры для нативных функций** (только когда нужно):
   - Camera API (вместо `<input type="file">`)
   - File System (для работы с файлами устройства)
   - Share API (для "поделиться")

3. **Утилиты определения платформы** (можно в `src/`):
   - Для условного рендеринга компонентов
   - Для выбора между веб-API и нативными плагинами

4. **Условный рендеринг в существующих компонентах**:
   ```vue
   <MobileHeader v-if="isMobile()" />
   <WebHeader v-else />
   ```

## Структура

```
src/                    # Основное приложение (работает везде)
├── main.js            # Точка входа (используется и в WebView)
├── src.vue            # Корневой компонент
└── ...

src-mobile/            # Только мобильные специфичные вещи
├── components/        # Мобильные UI компоненты (если нужны)
├── adapters/         # Адаптеры для нативных API (Camera, FileSystem)
└── utils/            # Утилиты (можно в src/)
```

## Когда использовать нативные плагины

### Используем веб-API (работает в WebView):
- ✅ localStorage → работает
- ✅ fetch/XMLHttpRequest → работает
- ✅ IndexedDB → работает
- ✅ Canvas/WebGL → работает
- ✅ `<input type="file">` → работает (но можно улучшить через Camera)

### Используем Capacitor плагины (только когда нужно):
- 📷 Camera → лучше UX чем `<input type="file">`
- 📁 File System → для работы с файлами устройства
- 🔔 Push Notifications → для уведомлений
- 📤 Share → для "поделиться"
- 🔋 Status Bar → для управления статус-баром

## Пример интеграции

### В существующем компоненте:

```vue
<!-- src/b-components/video-uploader/video-uploader.vue -->
<script setup>
import { isMobile } from '@mobile/utils' // или из src/utils
import { Camera } from '@capacitor/camera'

const pickImage = async () => {
  if (isMobile()) {
    // Используем нативную камеру
    const image = await Camera.getPhoto({...})
  } else {
    // Используем обычный input
    inputRef.value.click()
  }
}
</script>
```

### Мобильный компонент (только если нужен):

```vue
<!-- src-mobile/components/mobile-navigation.vue -->
<!-- Используется только на мобильных -->
```

## Инициализация Capacitor

Добавить в `src/main.js`:

```js
// Инициализация Capacitor (только если нужно)
if (import.meta.env.MODE === 'capacitor') {
  import('@capacitor/core').then(({ Capacitor }) => {
    if (Capacitor.isNativePlatform()) {
      // Настройка плагинов
      import('@capacitor/status-bar').then(({ StatusBar }) => {
        StatusBar.setStyle({ style: 'light' })
      })
    }
  })
}
```

## Вывод

**Минималистичный подход:**
- Веб-приложение работает как есть
- Добавляем мобильные адаптации только там, где это улучшает UX
- Используем условный рендеринг вместо дублирования кода
