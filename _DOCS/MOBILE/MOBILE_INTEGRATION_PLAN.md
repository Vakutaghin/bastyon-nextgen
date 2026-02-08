# План интеграции мобильной версии на базе Capacitor

## Основной принцип

**Capacitor = WebView + нативные плагины** (как Cordova)

**Веб-приложение в `src/` работает как есть в WebView!**

Не нужно дублировать код или создавать отдельные точки входа.

## Общая архитектура

### Структура проекта
```
bastyon-nextgen/
├── src/                    # Веб-проект (работает в WebView как есть)
│   ├── main.js            # Точка входа (используется везде)
│   ├── src.vue            # Корневой компонент
│   ├── b-components/      # Бизнес-компоненты
│   ├── components/        # Базовые UI компоненты
│   ├── blockchain/        # Блокчейн логика
│   ├── composables/       # Vue composables
│   ├── stores/            # Pinia stores
│   └── ...
│
├── src-mobile/            # Только мобильные специфичные адаптации
│   ├── components/        # Мобильные UI компоненты (если нужны)
│   │   ├── mobile-navigation/
│   │   └── ...
│   ├── layouts/           # Мобильные layouts (если нужны)
│   │   └── ...
│   ├── adapters/          # Адаптеры для нативных API (только когда нужно)
│   │   ├── capacitor-camera.ts
│   │   └── ...
│   ├── hooks/             # Мобильные hooks (если нужны)
│   │   └── ...
│   └── utils/             # Утилиты определения платформы
│       └── platform.ts
│
├── capacitor.config.ts    # Конфигурация Capacitor
├── vite.config.js         # Конфигурация Vite
└── package.json
```

## Этапы интеграции

### Этап 1: Создание структуры и определение платформы ✅

#### 1.1. Создать папку `src-mobile` и базовую структуру
- [x] Создать `src-mobile/utils/platform.ts` - утилита для определения платформы
- [x] Создать структуру папок (components, layouts, adapters, hooks)

#### 1.2. Расширить систему определения платформы
- [x] Обновить `src/b-components/video-uploader/utils/environment.ts`:
  - Добавить функцию `isCapacitor()` для определения Capacitor
  - Расширить `getBestConverter()` для поддержки Capacitor плагинов
- [x] Создать `src-mobile/utils/platform.ts` с функциями:
  - `getPlatform()`: 'web' | 'tauri' | 'capacitor-ios' | 'capacitor-android'
  - `isNative()`: boolean
  - `isMobile()`: boolean

#### 1.3. Настроить конфигурацию
- [x] Обновить `vite.config.js`:
  - Настроить alias для `@mobile` -> `src-mobile`
- [x] Обновить `src/main.js`:
  - Добавить опциональную инициализацию Capacitor

### Этап 2: Интеграция Capacitor плагинов ✅

#### 2.1. Установить необходимые Capacitor плагины
- [x] `@capacitor/app` - управление жизненным циклом приложения
- [x] `@capacitor/status-bar` - управление статус-баром
- [x] `@capacitor/keyboard` - управление клавиатурой
- [x] `@capacitor/splash-screen` - экран загрузки
- [x] `@capacitor/filesystem` - работа с файловой системой
- [x] `@capacitor/camera` - доступ к камере
- [x] `@capacitor/share` - функционал "поделиться"
- [x] `@capacitor/network` - мониторинг сети
- [x] `@capacitor/preferences` - локальное хранилище (но localStorage работает в WebView)

#### 2.2. Создать адаптеры для Capacitor API (только когда нужно)
- [x] `src-mobile/adapters/capacitor-camera.ts`:
  - Доступ к камере для фото/видео
  - Используется вместо `<input type="file">` для лучшего UX
- [ ] `src-mobile/adapters/capacitor-file-system.ts` (если понадобится):
  - Работа с файловой системой устройства
  - Интеграция с video-uploader для мобильных устройств

**Примечание:** localStorage работает в WebView, поэтому адаптер для storage не нужен.

### Этап 3: Мобильные компоненты и layouts

#### 3.1. Создать мобильные layout компоненты
- [ ] `src-mobile/layouts/mobile-layout.vue`:
  - Адаптивный layout для мобильных устройств
  - Навигация снизу (bottom tabs) или боковая (drawer)
  - Оптимизация для touch-интерфейса
- [ ] `src-mobile/components/mobile-header/`:
  - Компактный header для мобильных устройств
  - Интеграция с Capacitor Status Bar
- [ ] `src-mobile/components/mobile-navigation/`:
  - Bottom navigation bar
  - Или side drawer navigation
- [ ] `src-mobile/components/mobile-sidebar/`:
  - Адаптация существующего SidebarLeft для мобильных
  - Drawer-стиль с swipe-жестами

#### 3.2. Адаптировать существующие компоненты
- [ ] Создать мобильные версии компонентов в `src-mobile/components/`:
  - Мобильные варианты компонентов из `src/b-components/`
  - Использовать условный рендеринг на основе платформы
  - Или создать wrapper-компоненты

### Этап 4: Интеграция с веб-проектом

#### 4.1. Использовать веб-проект как есть
- [x] Веб-приложение в `src/` работает в WebView без изменений
- [x] Добавлена опциональная инициализация Capacitor в `src/main.js`
- [ ] Добавить условный рендеринг в компонентах где нужно:
  - Использовать `isMobile()` для выбора между веб и мобильными компонентами
  - Пример: `<MobileHeader v-if="isMobile()" />` или `<WebHeader v-else />`

#### 4.2. Использовать нативные плагины только когда нужно
- [ ] В компонентах где нужна камера:
  - Использовать `getPhoto()` из `@mobile/adapters` на мобильных
  - Использовать `<input type="file">` на веб
- [ ] В компонентах где нужен Share:
  - Использовать `@capacitor/share` на мобильных
  - Использовать Web Share API на веб (если доступен)

### Этап 5: Мобильные специфичные функции

#### 5.1. Обработка жизненного цикла приложения
- [ ] `src-mobile/hooks/use-capacitor.ts`:
  - Обработка событий App (pause, resume, etc.)
  - Управление состоянием приложения
- [ ] `src-mobile/hooks/use-mobile-keyboard.ts`:
  - Обработка появления/скрытия клавиатуры
  - Адаптация layout при открытии клавиатуры

#### 5.2. Нативные функции
- [ ] Интеграция с камерой для загрузки фото/видео
- [ ] Интеграция с файловой системой для работы с медиа
- [ ] Push-уведомления (если планируются)
- [ ] Deep linking (если планируется)

### Этап 6: Оптимизация и настройка

#### 6.1. Оптимизация производительности
- [ ] Lazy loading для мобильных компонентов
- [ ] Оптимизация bundle size
- [ ] Code splitting для мобильной версии

#### 6.2. Настройка Capacitor
- [ ] Обновить `capacitor.config.ts`:
  - Настройки для iOS и Android
  - Конфигурация плагинов
  - Настройки безопасности
- [ ] Настроить иконки и splash screen
- [ ] Настроить permissions для iOS и Android

#### 6.3. Настройка сборки
- [ ] Обновить `package.json` скрипты:
  - `build:web` - сборка веб-версии
  - `build:mobile` - сборка мобильной версии
  - `build:all` - сборка обеих версий
- [ ] Настроить разные точки входа в `vite.config.js`

## Детальная реализация

### 1. Система определения платформы

```typescript
// src-mobile/utils/platform.ts
import { Capacitor } from '@capacitor/core'

export type Platform = 'web' | 'tauri' | 'capacitor-ios' | 'capacitor-android'

export function getPlatform(): Platform {
  if (typeof window === 'undefined') return 'web'
  
  // Проверка Tauri
  const win = window as any
  if (win.__TAURI__ || win.__TAURI_INTERNALS__) {
    return 'tauri'
  }
  
  // Проверка Capacitor
  if (Capacitor.isNativePlatform()) {
    return Capacitor.getPlatform() === 'ios' ? 'capacitor-ios' : 'capacitor-android'
  }
  
  return 'web'
}

export function isNative(): boolean {
  return Capacitor.isNativePlatform()
}

export function isMobile(): boolean {
  const platform = getPlatform()
  return platform === 'capacitor-ios' || platform === 'capacitor-android'
}

export function isTauri(): boolean {
  return getPlatform() === 'tauri'
}
```

### 2. Использование нативной камеры (пример)

```typescript
// В компоненте video-uploader или другом
import { isMobile } from '@mobile/utils'
import { getPhoto } from '@mobile/adapters'

const pickImage = async () => {
  if (isMobile()) {
    // Используем нативную камеру для лучшего UX
    const imageDataUrl = await getPhoto({
      quality: 90,
      allowEditing: false,
      source: CameraSource.Prompt // Предлагает выбрать камеру или галерею
    })
    if (imageDataUrl) {
      // Обработка изображения
      handleImage(imageDataUrl)
    }
  } else {
    // На веб используем обычный input
    inputRef.value.click()
  }
}
```

### 3. Условный рендеринг компонентов

```vue
<!-- В существующем компоненте -->
<template>
  <div>
    <!-- Мобильный header (если создан) -->
    <MobileHeader v-if="isMobile()" />
    <WebHeader v-else />
    
    <!-- Основной контент работает везде -->
    <ContentFeed />
  </div>
</template>

<script setup>
import { isMobile } from '@mobile/utils'
import MobileHeader from '@mobile/components/mobile-header.vue'
import WebHeader from '@/b-components/header/app-header.vue'
</script>
```

### 4. Инициализация Capacitor (уже в main.js)

```javascript
// src/main.js - опциональная инициализация
if (typeof window !== 'undefined') {
  const initCapacitor = async () => {
    try {
      const { Capacitor } = await import('@capacitor/core')
      if (Capacitor.isNativePlatform()) {
        // Настройка Status Bar
        const { StatusBar, Style } = await import('@capacitor/status-bar')
        await StatusBar.setStyle({ style: Style.Light })
        
        // Скрытие Splash Screen
        const { SplashScreen } = await import('@capacitor/splash-screen')
        await SplashScreen.hide()
      }
    } catch (error) {
      // Игнорируем - приложение работает и без Capacitor
    }
  }
  initCapacitor()
}
```

## Порядок выполнения

1. **Неделя 1**: Этапы 1-2
   - Создание структуры `src-mobile`
   - Установка Capacitor плагинов
   - Система определения платформы
   - Базовые адаптеры

2. **Неделя 2**: Этапы 3-4
   - Мобильные компоненты и layouts
   - Интеграция с веб-проектом
   - Условный рендеринг

3. **Неделя 3**: Этапы 5-6
   - Мобильные специфичные функции
   - Оптимизация и настройка
   - Тестирование на устройствах

## Важные замечания

1. **Общий код**: Веб-проект в `src/` используется как есть в Capacitor, мобильные адаптации в `src-mobile/`

2. **Условная сборка**: Можно использовать разные точки входа или условный рендеринг в одном приложении

3. **Плагины**: Capacitor плагины работают только в нативном окружении, нужны fallback для веб

4. **Производительность**: Мобильные устройства требуют оптимизации bundle size и lazy loading

5. **Тестирование**: Обязательно тестировать на реальных устройствах iOS и Android
