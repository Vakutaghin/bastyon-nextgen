# Архитектура мобильной интеграции

## Схема архитектуры

```
┌─────────────────────────────────────────────────────────────┐
│                      Capacitor Container                     │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              src/ (Web Project)                        │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │  main.js → src.vue → AppLayout                   │  │  │
│  │  │  ├── b-components/ (бизнес-компоненты)           │  │  │
│  │  │  ├── blockchain/ (блокчейн логика)               │  │  │
│  │  │  ├── stores/ (Pinia stores)                      │  │  │
│  │  │  └── composables/ (Vue composables)              │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
│                          ↓                                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │          src-mobile/ (Mobile Adaptations)            │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │  main.ts → app.vue → MobileLayout               │  │  │
│  │  │  ├── components/ (мобильные компоненты)         │  │  │
│  │  │  ├── layouts/ (мобильные layouts)                │  │  │
│  │  │  ├── adapters/ (Capacitor адаптеры)             │  │  │
│  │  │  └── hooks/ (мобильные hooks)                    │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
│                          ↓                                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              shared/ (Common Code)                     │  │
│  │  ├── types/                                            │  │
│  │  ├── constants/                                        │  │
│  │  └── utils/                                            │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│              Native Platforms (iOS/Android)                  │
│  ┌──────────────┐              ┌──────────────┐            │
│  │  iOS Native  │              │Android Native│            │
│  │  Capacitor   │              │  Capacitor   │            │
│  │  Plugins     │              │   Plugins    │            │
│  └──────────────┘              └──────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

## Поток данных

```
User Action
    ↓
Mobile Component (src-mobile/)
    ↓
Platform Detection (isMobile? isNative?)
    ↓
┌─────────────────┬─────────────────┐
│   Web Fallback  │  Capacitor API │
│   (localStorage) │  (Preferences) │
└─────────────────┴─────────────────┘
    ↓
Shared Business Logic (src/)
    ↓
API / Blockchain
```

## Определение платформы

```typescript
Platform Detection Flow:

1. Check Tauri → isTauri()
   └─→ return 'tauri'

2. Check Capacitor → Capacitor.isNativePlatform()
   ├─→ iOS → return 'capacitor-ios'
   └─→ Android → return 'capacitor-android'

3. Default → return 'web'
```

## Структура импортов

```
src-mobile/main.ts
  ├─→ @capacitor/core (Capacitor API)
  ├─→ src/query-client.ts (shared)
  ├─→ src-mobile/app.vue
  └─→ src-mobile/layouts/mobile-layout.vue
        ├─→ src-mobile/components/mobile-header/
        ├─→ src-mobile/components/mobile-navigation/
        └─→ src/b-components/* (reuse web components)

src/src.vue (Web)
  ├─→ src/b-components/app-layout/
  └─→ src/b-components/* (web components)
```

## Ключевые решения

### 1. Разделение кода
- **src/**: Веб-проект, используется как есть в Capacitor
- **src-mobile/**: Мобильные адаптации и специфичные компоненты
- **shared/**: Общий код между платформами

### 2. Условный рендеринг
```vue
<!-- Пример -->
<template>
  <WebLayout v-if="!isMobile()" />
  <MobileLayout v-else />
</template>
```

### 3. Адаптеры для нативных API
```typescript
// Единый интерфейс для разных платформ
storage.getItem(key)  // работает везде
  ├─→ localStorage (web)
  ├─→ Preferences (mobile)
  └─→ Tauri store (desktop)
```

### 4. Плагины Capacitor
- Устанавливаются только для мобильных платформ
- Fallback на веб-API для разработки
- Проверка через `Capacitor.isNativePlatform()`

## Преимущества архитектуры

1. ✅ **Переиспользование кода**: Веб-проект используется без изменений
2. ✅ **Изоляция**: Мобильные адаптации отдельно
3. ✅ **Гибкость**: Легко добавлять платформо-специфичные функции
4. ✅ **Поддерживаемость**: Четкое разделение ответственности
5. ✅ **Масштабируемость**: Легко добавлять новые платформы
