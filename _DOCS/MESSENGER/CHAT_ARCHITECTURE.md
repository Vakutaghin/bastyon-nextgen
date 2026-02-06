# Архитектура личных чатов и групп в старом приложении

## Обзор

Старое приложение Pocketnet/Bastyon использует протокол **Matrix** для реализации системы чатов. Это включает в себя:
- Личные чаты между пользователями (Direct Messages)
- Групповые чаты (Rooms)
- End-to-end шифрование сообщений
- Интеграцию с блокчейном для аутентификации
- Push-уведомления через Firebase Cloud Messaging (FCM)

---

## 1. Технологический стек

### Протокол Matrix

**Matrix** - это открытый протокол для децентрализованной коммуникации в реальном времени. Он обеспечивает:
- Децентрализованную архитектуру (federation)
- End-to-end шифрование (E2EE)
- Синхронизацию между устройствами
- Групповые чаты и каналы

### Клиент Matrix Element

Приложение использует встроенный компонент **Matrix Element** - веб-клиент для Matrix, который встраивается в приложение как Vue компонент.

**Файлы:**
- `pocketnet.gui/chat/matrix-element.js` - основной компонент
- `pocketnet.gui/chat/matrix-element.min.js` - минифицированная версия
- Множество чанков для code splitting (matrix-element.0.js - matrix-element.30.js)

### Серверы Matrix

**Production:**
- `matrix.pocketnet.app` - основной Matrix сервер
- `matrix.2.pocketnet.app` - зеркало Matrix сервера

**Testnet:**
- `test.matrix.pocketnet.app` - тестовый Matrix сервер

---

## 2. Архитектура интеграции

### Схема компонентов

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                          │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │   User Profile   │         │   Chat UI        │          │
│  │   Components     │         │   Components     │          │
│  └────────┬─────────┘         └────────┬─────────┘          │
└───────────┼────────────────────────────┼─────────────────────┘
            │                            │
            ▼                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Matrix Chat Module (matrixchat)                 │
│  - init()                                                    │
│  - startchat(address)                                       │
│  - connect()                                                 │
│  - joinRoom(roomId)                                          │
│  - shareInChat()                                             │
└───────────┬─────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│              Matrix Element Component                        │
│  <matrix-element                                             │
│    address="..."                                             │
│    privatekey="..."                                          │
│    pocketnet="true"                                          │
│    ...                                                       │
│  />                                                          │
└───────────┬─────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│              Matrix SDK (matrix-js-sdk)                      │
│  - createClient()                                            │
│  - login()                                                    │
│  - createRoom()                                              │
│  - sendMessage()                                             │
└───────────┬─────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│              Matrix Server (matrix.pocketnet.app)            │
│  - Client-Server API                                        │
│  - Federation API                                           │
│  - Media API                                                │
└─────────────────────────────────────────────────────────────┘
```

### Инициализация чата

**Файл:** `pocketnet.gui/js/satolist.js` (строки 25269-25455)

Процесс инициализации:

1. **Проверка состояния пользователя:**
   ```javascript
   app.user.isState(function (state) {
       if (!state) return; // Пользователь не авторизован
   })
   ```

2. **Загрузка Matrix Element:**
   ```javascript
   importScript('chat/matrix-element.min.js?v=' + version, callback)
   ```

3. **Создание компонента:**
   ```javascript
   var matrix = `<div class="wrapper matrixchatwrapper">
       <matrix-element
           address="${userAddress}"
           privatekey="${privateKey}"
           pocketnet="true"
           mobile="${isMobile}"
           ctheme="${theme}"
           localization="${locale}"
           fcmtoken="${fcmToken}"
           ...
       />
   </div>`
   $('#matrix').html(matrix);
   ```

4. **Подключение к Matrix серверу:**
   - Компонент автоматически подключается к серверу
   - Использует приватный ключ для аутентификации
   - Синхронизирует историю сообщений

---

## 3. Аутентификация

### Блокчейн-аутентификация

В отличие от традиционных Matrix клиентов, приложение использует **блокчейн-аутентификацию**:

1. **Приватный ключ пользователя:**
   - Извлекается из блокчейн-кошелька пользователя
   - Передается в компонент Matrix Element
   - Используется для подписи запросов

2. **Адрес пользователя:**
   - Pocketnet адрес (например, `PJT8eTrx...`)
   - Используется как идентификатор пользователя в Matrix

3. **Процесс входа:**
   ```javascript
   // Приватный ключ передается в компонент
   privatekey="${privatekey}"
   
   // Matrix Element использует его для:
   // - Генерации Matrix user ID
   // - Подписи запросов
   // - Аутентификации на сервере
   ```

### Связь с блокчейном

Matrix аккаунт пользователя привязан к его блокчейн-адресу:
- При первом входе создается Matrix аккаунт
- User ID в Matrix основан на блокчейн-адресе
- Приватный ключ используется для криптографической аутентификации

---

## 4. Личные чаты (Direct Messages)

### Создание личного чата

**Метод:** `matrixchat.startchat(address)`

**Файл:** `pocketnet.gui/js/satolist.js` (строки 25347-25361)

```javascript
startchat: function (address) {
    if (self.matrixchat.core) {
        var link = 'contact?id=' + hexEncode(address)
        
        if (self.app.mobileview) {
            self.matrixchat.core.apptochat(link)
        } else {
            self.matrixchat.core.gopage(link)
        }
    }
}
```

**Процесс:**
1. Пользователь нажимает "Начать чат" на профиле другого пользователя
2. Вызывается `matrixchat.startchat(address)`
3. Matrix Element создает или открывает Direct Message комнату
4. Комната идентифицируется по адресам обоих пользователей

### Структура Direct Message комнаты

- **Тип:** `m.room.type: m.direct`
- **Участники:** Только два пользователя
- **Шифрование:** End-to-end шифрование включено по умолчанию
- **Идентификация:** По блокчейн-адресам участников

### Подключение к существующему чату

**Метод:** `matrixchat.connect()`

```javascript
connect: function () {
    if (self.matrixchat.connectWith) {
        return self.matrixchat.core.connect(self.matrixchat.connectWith)
            .then(r => {
                self.matrixchat.connectWith = null
            })
    }
}
```

---

## 5. Групповые чаты (Rooms)

### Создание группы

Групповые чаты создаются через Matrix Element UI или программно через Matrix SDK.

**Типы комнат:**
- **Публичные комнаты** - доступны по ссылке
- **Приватные комнаты** - только по приглашению
- **Каналы** - для широковещательных сообщений

### Присоединение к группе

**Метод:** `matrixchat.joinRoom(roomId)`

**Файл:** `pocketnet.gui/js/satolist.js` (строки 26032-26040)

```javascript
if (self.matrixchat.joinRoom) {
    return self.matrixchat.core.joinRoom(self.matrixchat.joinRoom)
        .then(r => {
            self.matrixchat.joinRoom = null
        })
}
```

**Способы присоединения:**

1. **По ссылке:**
   ```
   /chat?id={roomId}
   /chat?publicroom={roomId}
   ```

2. **Через параметры URL:**
   ```javascript
   var publicroom = parameters(url, true).publicroom
   self.matrixchat.joinRoom = publicroom || null
   ```

3. **Программно:**
   ```javascript
   platform.matrixchat.core.goto(data.room_id)
   ```

### Управление группами

**Функции:**
- Добавление/удаление участников
- Изменение настроек комнаты
- Назначение администраторов
- Модерация сообщений

---

## 6. Отправка сообщений

### Текстовые сообщения

Сообщения отправляются через Matrix Client API:

```javascript
// Внутри Matrix Element компонента
matrixClient.sendMessage(roomId, {
    msgtype: "m.text",
    body: "Текст сообщения"
})
```

### Медиа-файлы

**Типы медиа:**
- Изображения (`m.image`)
- Файлы (`m.file`)
- Аудио (`m.audio`)
- Видео (`m.video`)

**Процесс загрузки:**
1. Файл загружается на Matrix Media Server
2. Получается MXC URI (Matrix Content URI)
3. Отправляется сообщение с MXC URI

### Шаринг контента из приложения

**Метод:** `matrixchat.shareInChat.url(roomId, url)`

**Файл:** `pocketnet.gui/js/satolist.js` (строки 25644-25662)

```javascript
shareInChat: {
    url: function (id, url) {
        if (self.matrixchat.core) {
            self.matrixchat.core.apptochat()
            
            return self.matrixchat.core.mtrx.shareInChat(id, {
                urls: [url]
            }).catch(e => {
                self.matrixchat.core.backtoapp()
                return Promise.reject(e)
            })
        }
    }
}
```

**Использование:**
- Шаринг постов: `pocketnet://i?stx={txid}`
- Шаринг ссылок: обычные HTTP/HTTPS ссылки
- Шаринг медиа: ссылки на изображения/видео

---

## 7. End-to-End Шифрование (E2EE)

### Настройка шифрования

Matrix Element автоматически настраивает E2EE для:
- Личных чатов (всегда включено)
- Групповых чатов (по умолчанию включено)

### Ключи шифрования

- **Device keys** - ключи устройства для аутентификации
- **One-time keys** - для установления сессий
- **Megolm keys** - для группового шифрования

### Процесс шифрования

1. При первом входе генерируются ключи устройства
2. Ключи загружаются на Matrix сервер
3. При создании зашифрованной комнаты происходит обмен ключами
4. Сообщения шифруются на клиенте перед отправкой

---

## 8. Уведомления

### Firebase Cloud Messaging (FCM)

**Настройка:**
```javascript
<matrix-element
    fcmtoken="${fcmToken}"
    ...
/>
```

**Обновление токена:**
```javascript
changeFcm: function () {
    if (self.matrixchat.el) {
        self.matrixchat.el.find('matrix-element')
            .attr('fcmtoken', self.fcmtoken)
    }
}
```

### Типы уведомлений

1. **Новые сообщения:**
   - В личных чатах
   - В группах (если не отключены)

2. **Приглашения в группы:**
   - Уведомление о новом приглашении

3. **События комнаты:**
   - Изменение названия
   - Добавление/удаление участников

### Обработка уведомлений

**Метод:** `matrixchat.notify.event()`

**Файл:** `pocketnet.gui/js/satolist.js` (строки 25616-25641)

```javascript
notify: {
    event: function (matrixevent) {
        // Создание HTML уведомления
        var _el = $(self.matrixchat.notify.tpl(matrixevent))
        
        // Отправка в Electron (для десктоп приложения)
        electron.ipcRenderer.send('electron-notification-small', {
            title,
            body,
            image,
            roomid: matrixevent.roomId
        });
    }
}
```

### Счетчик непрочитанных

**Метод:** `matrixchat.getNotificationsCount()`

```javascript
getNotificationsCount: function () {
    if (self.matrixchat.core) {
        return self.matrixchat.core.getNotificationsCount()
    }
    return 0
}
```

---

## 9. Интеграция с блокчейном

### Транзакции в чате

**Метод:** `matrixchat.transaction(txid, roomId)`

**Файл:** `pocketnet.gui/js/satolist.js` (строки 25998-26009)

```javascript
transaction: function (id, roomid) {
    if (!self.matrixchat.core) return
    if (!roomid) return
    
    // Отправка информации о транзакции в чат
    self.matrixchat.core.mtrx.transaction(roomid, id)
}
```

**Использование:**
- Отправка ссылок на транзакции блокчейна
- Шаринг постов через протокол `pocketnet://i?stx={txid}`
- Интеграция с кошельком для переводов

### Массовая рассылка

**Настройка:**
```javascript
var massmailingenabled = self.app.platform.istest() || 
    (self.sdk.user.type(self.app.user.address.value) ? true : false)

<matrix-element
    massmailingenabled="${massmailingenabled}"
    ...
/>
```

**Ограничения:**
- Доступно только для определенных типов пользователей
- В тестовой сети доступно всем
- В production - только для пользователей с высоким рейтингом

---

## 10. UI/UX особенности

### Адаптивный дизайн

**Мобильная версия:**
```javascript
mobile="${isMobile}"
pocketnet=""  // Пустое для мобильной версии
```

**Десктопная версия:**
```javascript
mobile=""
pocketnet="true"  // Включено для десктопа
```

### Темы

**Поддержка тем:**
```javascript
ctheme="${currentTheme}"
```

**Обновление темы:**
```javascript
changeTheme: function () {
    if (self.matrixchat.el) {
        self.matrixchat.el.find('matrix-element')
            .attr('ctheme', self.sdk.theme.current)
    }
}
```

### Локализация

**Настройка языка:**
```javascript
localization="${locale}"
```

**Обновление локализации:**
```javascript
changeLocalization: function () {
    if (self.matrixchat.el) {
        self.matrixchat.el.find('matrix-element')
            .attr('localization', self.app.localization.key)
    }
}
```

### Навигация

**Swipe-жесты (мобильная версия):**
```javascript
self.matrixchat.chatparallax = new SwipeParallaxNew({
    el: self.matrixchat.el,
    directions: {
        left: {
            clbk: function () {
                // Возврат из чата в приложение
                self.matrixchat.core.backtoapp()
            }
        }
    }
})
```

---

## 11. Управление жизненным циклом

### Инициализация

**Условия:**
- Пользователь авторизован
- Не в режиме OpenAPI
- Не телевизионный режим
- Пользователь не заблокирован по репутации

**Процесс:**
1. Проверка состояния пользователя
2. Загрузка Matrix Element скрипта
3. Создание компонента
4. Подключение к серверу

### Уничтожение

**Метод:** `matrixchat.destroy()`

```javascript
destroy: function () {
    // Уничтожение swipe-параллакса
    if (self.matrixchat.chatparallax) {
        self.matrixchat.chatparallax.destroy()
        self.matrixchat.chatparallax = null
    }
    
    // Уничтожение Matrix Element
    if (window.matrixchat) {
        window.matrixchat.destroy()
    }
    
    // Очистка DOM
    $('#matrix').html('');
    
    // Сброс состояния
    self.matrixchat.el = null
    self.matrixchat.inited = false
}
```

### Деактивация аккаунта

**Метод:** `matrixchat.deactivateAccount()`

```javascript
deactivateAccount: function () {
    if (self.matrixchat.core) {
        return self.matrixchat.core.mtrx.deactivateAccount()
    }
    return Promise.reject('matrixchat.core')
}
```

**Использование:**
- При удалении аккаунта пользователя
- При выходе из системы
- При смене аккаунта

---

## 12. Синхронизация и хранение

### Синхронизация сообщений

Matrix автоматически синхронизирует:
- Историю сообщений
- Состояние комнат
- Профили пользователей
- Медиа-файлы

### Локальное хранение

Matrix Element хранит локально:
- Ключи шифрования (в IndexedDB)
- Кеш сообщений
- Медиа-файлы
- Настройки пользователя

### Синхронизация между устройствами

- Все устройства синхронизируются через Matrix сервер
- Ключи шифрования синхронизируются через сервер ключей
- Сообщения доступны на всех устройствах

---

## 13. Безопасность

### Криптография

- **End-to-end шифрование** для всех сообщений
- **Подпись запросов** приватным ключом
- **Верификация устройств** при первом входе

### Приватность

- **Децентрализация** - нет единой точки отказа
- **Federation** - возможность подключения к другим Matrix серверам
- **Контроль данных** - пользователь контролирует свои данные

### Ограничения доступа

- Пользователи с низкой репутацией могут быть заблокированы
- Массовая рассылка доступна только определенным типам пользователей
- Модерация контента на уровне комнат

---

## 14. Интеграция с другими компонентами

### Шаринг постов

**Из ленты:**
```javascript
if (p.roomid && txid) {
    self.matrixchat.shareInChat.url(
        p.roomid, 
        app.meta.protocol + '://i?stx=' + txid
    )
}
```

### Навигация из чата

**Deep links:**
- `pocketnet://i?stx={txid}` - открытие поста
- `pocketnet://contact?id={address}` - открытие профиля
- `pocketnet://chat?id={roomId}` - открытие чата

### Звонки (Bastyon Calls)

**Настройка:**
```javascript
iscallsenabled="true"
```

**Интеграция:**
- Видео/аудио звонки через WebRTC
- Использует Matrix для сигнализации
- Поддержка групповых звонков

---

## 15. Особенности реализации

### Code Splitting

Matrix Element разбит на множество чанков:
- `matrix-element.0.js` - `matrix-element.30.js`
- Ленивая загрузка для оптимизации

### Версионирование

```javascript
var vs = numfromreleasestring(window.packageversion) + 
         '_' + (window.versionsuffix || "0")
importScript('chat/matrix-element.min.js?v=' + vs, clbk)
```

### Обработка ошибок

- Автоматическое переподключение при разрыве связи
- Обработка ошибок аутентификации
- Fallback на зеркальные серверы

---

## 16. Конфигурация

### Файл конфигурации

**Файл:** `pocketnet.gui/config/Pocketnet.json`

```json
{
    "servers": {
        "production": {
            "matrix": "matrix.pocketnet.app"
        },
        "test": {
            "matrix": "test.matrix.pocketnet.app"
        }
    }
}
```

### Параметры компонента

**Обязательные:**
- `address` - блокчейн-адрес пользователя
- `privatekey` - приватный ключ в hex-формате

**Опциональные:**
- `pocketnet` - режим интеграции с Pocketnet
- `mobile` - мобильная версия
- `ctheme` - текущая тема
- `localization` - язык интерфейса
- `fcmtoken` - токен для push-уведомлений
- `iscallsenabled` - включение звонков
- `massmailingenabled` - массовая рассылка
- `viewtype` - тип отображения (split/single)
- `isSoundAvailable` - звуковые уведомления

---

## 17. Рекомендации для нового приложения

### Сохранение совместимости

1. **Использовать те же Matrix серверы:**
   - `matrix.pocketnet.app` для production
   - `test.matrix.pocketnet.app` для testnet

2. **Сохранить формат аутентификации:**
   - Блокчейн-адрес как идентификатор
   - Приватный ключ для подписи

3. **Поддержать существующие комнаты:**
   - Обеспечить доступ к существующим чатам
   - Сохранить историю сообщений

### Улучшения архитектуры

1. **Централизовать конфигурацию:**
   - Единый файл конфигурации для всех серверов
   - Переменные окружения для разных сред

2. **Улучшить обработку ошибок:**
   - Централизованный error handling
   - Retry механизмы
   - Логирование ошибок

3. **Оптимизировать производительность:**
   - Ленивая загрузка компонентов
   - Виртуализация списков сообщений
   - Кеширование медиа-файлов

4. **Улучшить безопасность:**
   - Безопасное хранение ключей
   - Регулярная ротация ключей
   - Аудит безопасности

---

## 18. Схемы и диаграммы

### Поток создания личного чата

```
Пользователь A                    Matrix Element              Matrix Server
     │                                  │                           │
     │ 1. startchat(addressB)          │                           │
     ├─────────────────────────────────>│                           │
     │                                  │                           │
     │                                  │ 2. createDirectRoom()     │
     │                                  ├───────────────────────────>│
     │                                  │                           │
     │                                  │ 3. Room Created           │
     │                                  │<───────────────────────────┤
     │                                  │                           │
     │ 4. Room Opened                  │                           │
     │<─────────────────────────────────┤                           │
     │                                  │                           │
     │ 5. Send Message                 │                           │
     ├─────────────────────────────────>│                           │
     │                                  │ 6. Encrypt & Send         │
     │                                  ├───────────────────────────>│
     │                                  │                           │
     │                                  │ 7. Deliver to User B      │
     │                                  │<───────────────────────────┤
```

### Поток присоединения к группе

```
Пользователь                    Matrix Element              Matrix Server
     │                                  │                           │
     │ 1. joinRoom(roomId)             │                           │
     ├─────────────────────────────────>│                           │
     │                                  │                           │
     │                                  │ 2. Join Room Request      │
     │                                  ├───────────────────────────>│
     │                                  │                           │
     │                                  │ 3. Room Joined            │
     │                                  │<───────────────────────────┤
     │                                  │                           │
     │                                  │ 4. Sync History           │
     │                                  ├───────────────────────────>│
     │                                  │                           │
     │                                  │ 5. History Received        │
     │                                  │<───────────────────────────┤
     │                                  │                           │
     │ 6. Room Displayed               │                           │
     │<─────────────────────────────────┤                           │
```

---

## 19. Заключение

Архитектура чатов в старом приложении основана на протоколе Matrix с глубокой интеграцией с блокчейном. Это обеспечивает:

- **Децентрализацию** - нет единой точки отказа
- **Безопасность** - end-to-end шифрование
- **Приватность** - контроль пользователя над данными
- **Совместимость** - возможность общения с другими Matrix серверами
- **Масштабируемость** - поддержка больших групп и высокой нагрузки

При миграции на новое приложение важно сохранить эту архитектуру и улучшить её там, где это возможно.
