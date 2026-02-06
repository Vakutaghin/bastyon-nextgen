# Архитектура подключения к Tor в Electron приложении

## Обзор

Старое приложение Pocketnet/Bastyon использует встроенный механизм подключения к сети Tor для обеспечения анонимности и обхода блокировок. Tor интегрирован непосредственно в Electron приложение через Node.js модуль, который управляет жизненным циклом Tor процесса и настраивает SOCKS5 прокси для всех сетевых запросов.

---

## 1. Архитектура компонентов

### Схема компонентов

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Main Process                     │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │   Main Window    │         │   IPC Bridge     │         │
│  │   (Renderer)     │◄────────┤   (ipc.js)       │         │
│  └────────┬─────────┘         └────────┬─────────┘         │
└───────────┼────────────────────────────┼─────────────────────┘
            │                            │
            ▼                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Proxy16 Module (proxy.js)                      │
│  - TorControl                                               │
│  - Transports                                               │
│  - NodeManager                                              │
└───────────┬─────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│              TorControl (torcontrol.js)                     │
│  - Управление Tor процессом                                 │
│  - Генерация конфигурации (torrc)                          │
│  - Установка Tor бинарников                                │
│  - Мониторинг состояния                                    │
└───────────┬─────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│              Tor Process (tor.exe/tor)                      │
│  - SOCKS5 прокси на 127.0.0.1:9250                        │
│  - Control Port на 127.0.0.1:9251                        │
│  - Snowflake bridges (опционально)                        │
└───────────┬─────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│              Transports (transports.js)                     │
│  - SocksProxyAgent (socks5h://127.0.0.1:9250)             │
│  - Маршрутизация запросов через Tor                        │
│  - Fallback на прямое подключение                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Установка и инициализация Tor

### Автоматическая установка

**Файл:** `pocketnet.gui/proxy16/node/torcontrol.js`

Tor устанавливается автоматически при первом запуске, если бинарники не найдены.

**Процесс установки:**

1. **Проверка наличия Tor:**
   ```javascript
   needinstall = () => {
       var existsBin = this.helpers.checkPath(this.getpath());
       this.isInstalled = existsBin.exists;
       return !existsBin.exists;
   }
   ```

2. **Скачивание бинарников:**
   ```javascript
   install = async () => {
       this.state.status = "install";
       
       // Скачивание из GitHub репозитория
       const download = await this.application.download('bin', {
           user: "shpingalet007", 
           name: "tor-builds"
       });
       
       // Распаковка
       await this.application.decompress(download.path, this.getsettingspath());
       
       // Установка прав доступа
       await fs.chmod(this.getpath(), 0o755);
       
       this.state.status = "stopped";
   }
   ```

3. **Поддерживаемые платформы:**
   - `darwin_x64` - macOS (Intel)
   - `win32_x86` - Windows 32-bit
   - `win32_x64` - Windows 64-bit
   - `linux_x86` - Linux 32-bit
   - `linux_x64` - Linux 64-bit

**Источник бинарников:**
- GitHub: `https://github.com/shpingalet007/tor-builds/releases/latest`
- Автоматический выбор версии для платформы

### Пути установки

**Windows:**
```
%APPDATA%/pocketnet/proxy16/tor/
```

**macOS:**
```
~/Library/Application Support/pocketnet/proxy16/tor/
```

**Linux:**
```
~/.config/pocketnet/proxy16/tor/
```

**Структура директории:**
```
tor/
├── tor.exe (или tor)
├── torrc (конфигурационный файл)
├── data/ (данные Tor)
│   ├── geoip
│   ├── geoip6
│   └── ...
├── pluggable_transports/
│   ├── snowflake-client.exe (или snowflake-client)
│   └── obfs4proxy.exe (или obfs4proxy)
└── tor.pid (PID процесса)
```

---

## 3. Конфигурация Tor

### Генерация конфигурационного файла (torrc)

**Метод:** `makeConfig()`

**Файл:** `pocketnet.gui/proxy16/node/torcontrol.js` (строки 195-314)

**Базовая конфигурация:**

```javascript
let torConfig = [
    "SocksPort 9250    # Default: Bind to localhost:9250 for local connections.",
    "ControlPort 9251",
    "CookieAuthentication 1",
    "DormantCanceledByStartup 1",
    `DataDirectory ${getSettingsPath("data")}`,
    "Log notice stdout",
    "AvoidDiskWrites 1",
    `GeoIPFile ${getSettingsPath("geoip")}`,
    `GeoIPv6File ${getSettingsPath("geoip6")}`,
    "KeepalivePeriod 10",
];
```

**Параметры:**
- **SocksPort 9250** - SOCKS5 прокси на локальном порту 9250
- **ControlPort 9251** - Порт управления Tor (для команд)
- **CookieAuthentication 1** - Аутентификация через cookie файл
- **DormantCanceledByStartup 1** - Отмена режима ожидания при старте
- **AvoidDiskWrites 1** - Минимизация записи на диск
- **KeepalivePeriod 10** - Период keepalive пакетов (секунды)

### Snowflake Bridges

**Настройка Snowflake для обхода блокировок:**

```javascript
if (useSnowFlake2) {
    torConfig.push(
        "UseBridges 1",
        `ClientTransportPlugin snowflake exec ${getSettingsPath("pluggable_transports", "snowflake-client")}`,
        `Bridge snowflake 192.0.2.4:80 8838024498816A039FCBBAB14E6F40A0843051FA fingerprint=8838024498816A039FCBBAB14E6F40A0843051FA url=https://snowflake-broker.torproject.net/ ampcache=https://cdn.ampproject.org/ fronts=www.google.com,cdn.ampproject.org utls-imitate=hellorandomizedalpn ice=stun:stun.nextcloud.com:443,stun:stun.sipgate.net:10000,stun:stun.epygi.com:3478,stun:stun.uls.co.za:3478,stun:stun.voipgate.com:3478,stun:stun.bethesda.net:3478,stun:stun.mixvoip.com:3478,stun:stun.voipia.net:3478`,
        `Bridge snowflake 192.0.2.3:80 2B280B23E1107BB62ABFC40DDCC8824814F80A72 fingerprint=2B280B23E1107BB62ABFC40DDCC8824814F80A72 url=https://snowflake-broker.torproject.net/ ampcache=https://cdn.ampproject.org/ fronts=www.google.com,cdn.ampproject.org utls-imitate=hellorandomizedalpn ice=stun:stun.nextcloud.com:443,stun:stun.sipgate.net:10000,stun:stun.epygi.com:3478,stun:stun.uls.co.za:3478,stun:stun.voipgate.com:3478,stun:stun.bethesda.net:3478,stun:stun.mixvoip.com:3478,stun:stun.voipia.net:3478`
    );
}
```

**Snowflake брокеры:**
- `snowflake-broker.torproject.net` - основной брокер
- `snowflake-broker.azureedge.net` - альтернативный (Azure CDN)
- `1098762253.rsc.cdn77.org` - CDN77 брокер
- `snowflake-broker.torproject.net.global.prod.fastly.net` - Fastly брокер

**STUN серверы для Snowflake:**
- `stun.l.google.com:19302`
- `stun.nextcloud.com:443`
- `stun.sipgate.net:10000`
- `stun.epygi.com:3478`
- `stun.uls.co.za:3478`
- `stun.voipgate.com:3478`
- `stun.bethesda.net:3478`
- `stun.mixvoip.com:3478`
- `stun.voipia.net:3478`
- `stun.antisip.com:3478`
- `stun.bluesip.net:3478`
- `stun.dus.net:3478`
- `stun.sonetel.com:3478`
- `stun.voys.nl:3478`

### OBFS4 Bridges

**Настройка кастомных OBFS4 мостов:**

```javascript
if (customObfs4) {
    torConfig.push(
        "UseBridges 1",
        `ClientTransportPlugin obfs4 exec ${getSettingsPath("pluggable_transports", "obfs4proxy")} managed`,
        customObfs4.map(b => `Bridge ${b}`).join('\n'),
    );
}
```

---

## 4. Запуск и управление Tor процессом

### Запуск Tor

**Метод:** `start()`

**Файл:** `pocketnet.gui/proxy16/node/torcontrol.js` (строки 438-514)

```javascript
start = async () => {
    // Проверка установки
    if (this.needinstall()) {
        await this.install();
    }
    
    // Создание конфигурации
    var configCreated = await this.makeConfig();
    
    // Убийство предыдущего процесса (если есть)
    await this.getpidandkill();
    
    // Запуск Tor процесса
    this.instance = child_process.spawn(this.getpath(), [
        "-f", `${path.join(this.getsettingspath(), "torrc")}`,
    ], {
        stdio: ['ignore'],
        detached: false,
        shell: false,
        env: {
            'LD_LIBRARY_PATH': this.getsettingspath()
        }
    });
    
    // Обработка событий
    this.instance.on("error", (error) => {
        this.stop();
        this.log({ error });
    });
    
    this.instance.on("exit", async (code) => {
        this.stop();
        if(code) {
            console.error(`TOR exit with code: ${code}`);
        }
    });
    
    // Логирование
    this.instance.stderr.on("data", (chunk) => this.log({error: String(chunk)}));
    this.instance.stdout.on("data", (chunk) => this.log({data: String(chunk)}));
    
    // Сохранение PID
    this.savepid(this.instance.pid);
}
```

### Состояния Tor

**Возможные состояния:**
- `stopped` - остановлен
- `install` - установка
- `running` - запускается
- `started` - запущен и готов
- `failed` - ошибка

**Мониторинг состояния:**

```javascript
log = (data) => {
    const isBootstrapped100 = ({ data }) => data?.includes('Bootstrapped 100%');
    const isConnected = ({ data }) => (/Managed proxy .*: connected/g).test(data);
    const isBrokerFailure = ({ data }) => (/Managed proxy .*: broker failure/g).test(data);
    const isConnectionFailure = ({ data }) => (/Managed proxy .*: connection failed/g).test(data);
    const isRetryingConnection = ({ data }) => (/Retrying on a new circuit/g).test(data);
    const extractBootstrapMessage = ({ data }) => (data?.match(/Bootstrapped \d+%.*/) || [null])[0];
    
    const message = extractBootstrapMessage(data);
    if (message !== null) this.state.info = message;
    
    if (isBrokerFailure(data) || isConnectionFailure(data)) {
        console.warn("Tor connection lost");
    } else if (isBootstrapped100(data)) {
        console.log("Tor instance started again");
        this.state.status = "started";
    } else if (isRetryingConnection(data)) {
        console.warn("Tor retrying circuit");
    }
}
```

### Остановка Tor

**Метод:** `stop()`

```javascript
stop = async () => {
    if (this.instance) {
        try {
            await this.getpidandkill();
        } catch(e) {
            console.warn('Tor instance kill error:', e.message);
        }
    }
    
    this.state.status = "stopped";
    this.instance = null;
    this.installfailed = null;
    
    clearInterval(this.timeoutIntervalId);
    this.timeoutIntervalId = null;
    
    return true;
}
```

**Убийство процесса:**
- Используется библиотека `tree-kill` для гарантированного завершения процесса и всех дочерних процессов
- PID сохраняется в файл `tor.pid` для возможности восстановления

### Автоматическое управление

**Режимы работы:**

1. **`neveruse`** - Tor никогда не используется
2. **`auto`** - Tor запускается автоматически при необходимости, выключается через 5 минут простоя
3. **`always`** - Tor всегда включен

**Таймер простоя (режим `auto`):**

```javascript
startTimer = () => {
    const minutes5 = 5 * 60 * 1000;
    this.timeoutCounter = minutes5;
    
    this.timeoutIntervalId = setInterval(() => {
        this.timeoutCounter -= 5000;
        
        if (this.timeoutCounter <= 0) {
            console.log("Tor was idle for 5 minutes, switching it off");
            this.stop();
            this.timeoutCounter = null;
            clearInterval(this.timeoutIntervalId);
        }
    }, 5000);
}
```

---

## 5. Интеграция с сетевой подсистемой

### SOCKS5 Proxy Agent

**Файл:** `pocketnet.gui/proxy16/transports.js`

**Создание SOCKS5 агента:**

```javascript
getTorAgent() {
    if (!this.torAgent) {
        const url = new URL('socks5h://127.0.0.1:9250');
        url.tls = { rejectUnauthorized: false };
        this.torAgent = new SocksProxyAgent(url, {
            keepAlive: true,
            timeout: 60000,
        });
    }
    return this.torAgent;
}
```

**Параметры:**
- **URL:** `socks5h://127.0.0.1:9250` - SOCKS5 с DNS через Tor (socks5h)
- **keepAlive:** `true` - поддержание соединения
- **timeout:** `60000` - таймаут 60 секунд
- **rejectUnauthorized:** `false` - не проверять SSL сертификаты (для .onion сайтов)

### Определение необходимости использования Tor

**Метод:** `isTorNeeded(url)`

```javascript
async isTorNeeded(url) {
    const torCtrl = this.torapplications;
    
    const isTorEnabledInSettings = (torCtrl.settings.enabled3 !== 'neveruse');
    const isDirectAccessRestricted = (torCtrl.settings.enabled3 === 'always');
    
    let useDirectAccess = false;
    
    if (!isTorEnabledInSettings) {
        useDirectAccess = true;
    } else if (!isDirectAccessRestricted) {
        // Проверка доступности прямого подключения
        useDirectAccess = await this.hasDirectAccess(url);
    }
    
    let isTorReady = this.isTorReady();
    
    // Запуск Tor, если нужен, но не готов
    if (!useDirectAccess && !isTorReady) {
        torCtrl.start();
        isTorReady = await this.waitTorReady();
    }
    
    const useTor = (!useDirectAccess && isTorReady && isTorEnabledInSettings);
    
    return !!useTor;
}
```

**Логика принятия решения:**

1. Если Tor отключен в настройках (`neveruse`) → прямое подключение
2. Если Tor обязателен (`always`) → всегда через Tor
3. Если Tor автоматический (`auto`) → проверка доступности прямого подключения
4. Если прямое подключение недоступно → использование Tor

### Ожидание готовности Tor

**Метод:** `waitTorReady()`

```javascript
async waitTorReady() {
    const timeout = 120000; // 2 минуты
    const checkInterval = 1000; // 1 секунда
    
    const torStart = new Promise((resolve) => {
        const check = setInterval(() => {
            if (this.isTorReady()) {
                clearInterval(check);
                resolve(true);
            }
        }, checkInterval);
        
        setTimeout(() => {
            clearInterval(check);
            resolve(false);
        }, timeout);
    });
    
    return Promise.race([torStart, timeout]);
}
```

### Использование Tor в запросах

**Пример использования в fetch:**

```javascript
async fetch(url, options = {}) {
    const useTor = await this.isTorNeeded(url);
    
    if (useTor) {
        const agent = this.getTorAgent();
        options.agent = agent;
    }
    
    return fetch(url, options);
}
```

**Обработка ошибок:**

```javascript
checkForAgentError(error) {
    const isSocksRejected = /Socks5 proxy rejected connection/;
    const isSocketNotCreated = /A "socket" was not created/;
    
    return (
        isSocksRejected.test(error.message) ||
        isSocketNotCreated.test(error.message)
    );
}

isTorRefuseConnections(error) {
    return error.message.includes('ECONNREFUSED 127.0.0.1:9250');
}
```

---

## 6. Интеграция с Electron

### IPC Bridge

**Файл:** `pocketnet.gui/proxy16/ipc.js`

**Связь между Renderer и Main процессом:**

```javascript
var IPC = function(ipc, wc, ComLayer) {
    var self = this;
    
    const comLayerBridge = new ComLayer(ipc, {
        isAltTransportSet: kit.manage.transports.isAltTransportSet,
        fetch: kit.manage.transports.fetch,
    });
    
    // Обработка сообщений от Renderer процесса
    var handleMessage = function(e, message) {
        // Маршрутизация запросов через Tor
    }
}
```

### Инициализация в Main процессе

**Файл:** `pocketnet.gui/tpls/main.js.tpl`

```javascript
const ProxyInterface = require('./proxy16/ipc.js')

// Инициализация Proxy16 модуля
var proxyInterface = new ProxyInterface(ipcMain, win.webContents, ComLayer);
```

**Примечание:** В коде есть закомментированная строка:
```javascript
// app.commandLine.appendSwitch('proxy-server', "socks5h://127.0.0.1:9050")
```

Это означает, что глобальная настройка прокси для Electron не используется. Вместо этого используется программная маршрутизация через `SocksProxyAgent`.

---

## 7. Настройки пользователя

### Параметры конфигурации

**Структура настроек:**

```javascript
settings = {
    tor: {
        enabled3: 'auto' | 'always' | 'neveruse',  // Режим работы
        useSnowFlake2: true | false,                // Использование Snowflake
        customObfs4: string[] | null,               // Кастомные OBFS4 мосты
        path: string                                 // Путь к директории Tor
    }
}
```

### Режимы работы

1. **`neveruse`** - Tor полностью отключен
   - Не устанавливается
   - Не запускается
   - Все запросы идут напрямую

2. **`auto`** - Автоматический режим
   - Tor запускается при необходимости
   - Автоматически выключается через 5 минут простоя
   - Проверяет доступность прямого подключения перед использованием Tor

3. **`always`** - Всегда включен
   - Tor запускается при старте приложения
   - Все запросы идут через Tor
   - Не выключается автоматически

### Изменение настроек

**Метод:** `settingChanged(settings)`

```javascript
settingChanged = async(settings) => {
    var needRestart = false;
    
    const isSnowflakeChanged = (settings.useSnowFlake2 !== this.settings.useSnowFlake2);
    const isTorStateChanged = (settings.enabled3 !== this.settings.enabled3);
    const isCustomObfs4Changed = (settings.customObfs4 !== this.settings.customObfs4);
    
    const keepInstanceAlive = (
        settings.enabled3 === 'auto' && this.settings.enabled3 === 'always' ||
        settings.enabled3 === 'always' && this.settings.enabled3 === 'auto'
    );
    
    if(isSnowflakeChanged || isCustomObfs4Changed || (isTorStateChanged && !keepInstanceAlive)) {
        needRestart = true;
    }
    
    this.settings = {...settings};
    
    if (needRestart) {
        try {
            await this.autorun();
        } catch (e) {
            this.startFailed(e);
        }
    }
}
```

---

## 8. Безопасность и приватность

### Анонимность

- **SOCKS5 с DNS через Tor** (`socks5h`) - DNS запросы также идут через Tor
- **Изоляция цепей** - каждый запрос может использовать новую цепь
- **Нет утечек DNS** - все DNS запросы идут через Tor

### Защита от блокировок

1. **Snowflake Bridges:**
   - Обход блокировок через WebRTC туннели
   - Использование CDN для маскировки трафика
   - Автоматический выбор доступного брокера

2. **OBFS4 Bridges:**
   - Обфускация трафика
   - Защита от DPI (Deep Packet Inspection)
   - Поддержка кастомных мостов

### Ограничения

- **Производительность:** Tor замедляет соединения (обычно в 2-5 раз)
- **Некоторые сайты блокируют Tor:** Могут быть недоступны через Tor
- **Требует ресурсов:** Tor процесс потребляет память и CPU

---

## 9. Мониторинг и диагностика

### Логирование

**Уровни логов:**
- `notice` - стандартный уровень (используется в конфигурации)
- Логи выводятся в `stdout` и `stderr` процесса Tor

**Парсинг логов:**

```javascript
log = (data) => {
    // Извлечение процента загрузки
    const extractBootstrapMessage = ({ data }) => 
        (data?.match(/Bootstrapped \d+%.*/) || [null])[0];
    
    // Определение состояния
    const isBootstrapped100 = ({ data }) => 
        data?.includes('Bootstrapped 100%');
    const isBrokerFailure = ({ data }) => 
        (/Managed proxy .*: broker failure/g).test(data);
    const isConnectionFailure = ({ data }) => 
        (/Managed proxy .*: connection failed/g).test(data);
    const isRetryingConnection = ({ data }) => 
        (/Retrying on a new circuit/g).test(data);
}
```

### Информация о состоянии

**Метод:** `info(compact)`

```javascript
info = (compact) => {
    var info = {
        enabled3: this.settings.enabled3,
        useSnowFlake2: this.settings.useSnowFlake2,
        customObfs4: this.settings.customObfs4,
        installed: this.isInstalled,
        state: {
            status: this.state.status,
            info: this.state.info  // Текущее сообщение о загрузке
        }
    };
    
    if(!compact) {
        info.instance = this.instance ? this.instance.pid : null;
        info.binPath = path.join(this.getpath());
        info.dataPath = this.getsettingspath();
    }
    
    return info;
}
```

---

## 10. Обработка ошибок

### Типичные ошибки

1. **ECONNREFUSED 127.0.0.1:9250**
   - Tor не запущен или не готов
   - Решение: ожидание готовности или перезапуск

2. **Socks5 proxy rejected connection**
   - Проблема с SOCKS5 соединением
   - Решение: перезапуск Tor или проверка конфигурации

3. **Broker failure (Snowflake)**
   - Проблема с Snowflake брокером
   - Решение: автоматический retry или переключение на другой брокер

4. **Connection failed**
   - Не удалось установить соединение через Tor
   - Решение: retry с новой цепью

### Стратегии восстановления

1. **Автоматический перезапуск:**
   ```javascript
   if (isBrokerFailure(data) || isConnectionFailure(data)) {
       console.warn("Tor connection lost");
       // Автоматический retry
   }
   ```

2. **Fallback на прямое подключение:**
   - Если Tor недоступен и режим `auto`
   - Автоматическое переключение на прямое подключение

3. **Retry с новой цепью:**
   ```javascript
   if (isRetryingConnection(data)) {
       console.warn("Tor retrying circuit");
   }
   ```

---

## 11. Производительность

### Оптимизации

1. **AvoidDiskWrites 1** - минимизация записи на диск
2. **KeepalivePeriod 10** - оптимизация keepalive пакетов
3. **Connection pooling** - переиспользование соединений через `keepAlive: true`

### Метрики

- **Время запуска:** обычно 10-30 секунд до готовности
- **Задержка запросов:** +200-500ms через Tor
- **Пропускная способность:** зависит от выбранной цепи, обычно 1-5 Мбит/с

---

## 12. Интеграция с блокчейн-нодой

### Tor Control в блокчейн-ноде

**Файл:** `pocketnet.core/src/torcontrol.cpp`

Блокчейн-нода также может использовать Tor для создания onion сервисов:

```cpp
// Подключение к Tor Control Port
const std::string DEFAULT_TOR_CONTROL = "127.0.0.1:9051";

// Создание onion сервиса
void StartTorControl(CService onion_service_target);
```

**Использование:**
- Создание скрытых сервисов для P2P соединений
- Анонимное подключение к другим нодам
- Защита IP адреса ноды

---

## 13. Рекомендации для нового приложения

### Сохранение совместимости

1. **Использовать те же порты:**
   - SOCKS5: `127.0.0.1:9250`
   - Control: `127.0.0.1:9251`

2. **Сохранить структуру конфигурации:**
   - Формат `torrc` файла
   - Параметры Snowflake bridges
   - Поддержка OBFS4

3. **Поддержать те же режимы работы:**
   - `neveruse`, `auto`, `always`

### Улучшения

1. **Улучшить обработку ошибок:**
   - Более детальное логирование
   - Автоматическое восстановление при сбоях
   - Уведомления пользователя о проблемах

2. **Оптимизировать производительность:**
   - Кеширование состояния Tor
   - Предзагрузка Tor при старте приложения (в режиме `always`)
   - Оптимизация таймаутов

3. **Улучшить UX:**
   - Индикатор состояния Tor в UI
   - Прогресс загрузки Tor
   - Настройки в пользовательском интерфейсе

4. **Безопасность:**
   - Проверка целостности Tor бинарников
   - Автоматическое обновление Tor
   - Аудит конфигурации

---

## 14. Схемы и диаграммы

### Поток запуска Tor

```
Пользователь/Приложение
     │
     │ 1. Требуется Tor
     ▼
┌─────────────────────┐
│  Проверка установки │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     │          │
   Нет        Да
     │          │
     ▼          ▼
┌─────────┐  ┌──────────────┐
│Установка│  │Создание torrc│
└────┬────┘  └──────┬───────┘
     │              │
     └──────┬───────┘
            │
            ▼
     ┌──────────────┐
     │ Запуск Tor   │
     └──────┬───────┘
            │
            ▼
     ┌──────────────┐
     │ Bootstrap    │
     │ 0% → 100%   │
     └──────┬───────┘
            │
            ▼
     ┌──────────────┐
     │ Tor Ready    │
     │ SOCKS5:9250  │
     └──────────────┘
```

### Поток запроса через Tor

```
Приложение
     │
     │ 1. HTTP Request
     ▼
┌─────────────────────┐
│ isTorNeeded(url)?   │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     │          │
    Да         Нет
     │          │
     ▼          ▼
┌─────────┐  ┌──────────────┐
│Tor Ready?│  │Direct Request│
└────┬────┘  └──────────────┘
     │
  ┌──┴──┐
  │     │
 Нет   Да
  │     │
  ▼     ▼
┌─────┐ ┌──────────────────┐
│Start│ │SOCKS5 Proxy Agent│
│ Tor │ │socks5h://9250    │
└──┬──┘ └────────┬─────────┘
   │             │
   └──────┬──────┘
          │
          ▼
    ┌──────────┐
    │Tor Network│
    └─────┬────┘
          │
          ▼
    ┌──────────┐
    │  Target   │
    │  Server   │
    └──────────┘
```

---

## 15. Заключение

Встроенный механизм подключения к Tor в Electron приложении обеспечивает:

- **Автоматическую установку и настройку** Tor
- **Гибкое управление** через три режима работы
- **Обход блокировок** через Snowflake и OBFS4 bridges
- **Прозрачную интеграцию** с сетевой подсистемой
- **Надежную работу** с автоматическим восстановлением

При миграции на новое приложение важно сохранить эту функциональность и улучшить её там, где это возможно, особенно в части производительности и пользовательского опыта.

---

## 16. Роль Proxy16 и маршрутизация запросов

- Proxy16 — локальный сетевой слой в Main-процессе Electron, принимающий пакеты от Renderer по IPC и маршрутизирующий их на соответствующие API-обработчики.
- Основные обязанности:
  - Выполнение RPC к нодам Pocketnet (выбор ноды, очереди, тайминги, ретраи, возврат метаданных node/time/code).
  - Управление кешем ответов и спец-кодами: 208 (кеш), 207 (“smart”), 408 (слишком много попыток) и автоматический failover.
  - Интеграция Tor: принятие решения об использовании SOCKS5 (socks5h://127.0.0.1:9250), подключение агента к axios/fetch/request, старт/ожидание готовности Tor.
  - Доп. подсистемы: локальный HTTPS/WSS, translate API, Peertube, уведомления, кошелек, боты — единый gateway по путям `/rpc/*`, `/manage`, `/nodes/*`.
- Ключевые узлы:
  - IPC-мост: `proxy16/ipc.js` — получение сообщений `proxy-message`, вызов `kit.gateway(message)`.
  - Gateway: `proxy16/kit.js` — поиск API по `path`, авторизация, вызов `proxy.api.*`.
  - RPC-роут: `proxy16/proxy.js` → `api.node.rpc` — выбор ноды, кеширование/удаление из кеша на ошибках, повторные попытки.
  - Транспорт: `proxy16/transports.js` — обёртки над axios/node-fetch/request с SOCKS5 агентом, проверка доступности хоста и решения “Tor / Direct”.

---

## 17. Визуализация запросов (аналог DevTools)

- Запросы renderer/Service Worker видны в DevTools → вкладка Network. Запросы, выполняемые внутри Main (axios/node-fetch/request) не попадают туда напрямую.
- Практичные варианты визуализации:
  - Логирование Main: включить electron-log/уровни, расширить логи в `transports.js`/`proxy.js` (время, размер, код, тип транспорта tor/direct).
  - Встроенная панель в UI:
    - Service Worker уже отправляет метрики: `swBroadcaster.send('network-stats', {status, url, torUsed, bytesLength, totalStats})`. Отобразить их в отдельной панели.
    - Логировать IPC-пакеты `proxy-message` в Renderer (идентификатор запроса, путь, длительность) и ответы `proxy-message` из Main.
  - Инспекция Main DevTools: опционально, сложнее в использовании; предпочтительнее выводить телеметрию в UI.

---

## 18. Диаграмма взаимодействия с внешними серверами

```
[Renderer (UI)]                          [Service Worker]                  [Main (Electron)]                     [Внешние сервисы]
       |                                        |                                 |                                         |
       | 1) IPC 'proxy-message' (rpc/manage)    |                                 |                                         |
       |--------------------------------------->| (не участвует)                   |                                         |
       |                                        |                                 |  gateway -> proxy.api.*                 |
       |                                        |                                 |  - node.rpc: выбор ноды, кеш, retry     |
       |                                        |                                 |  - manage/nodes/peertube/...            |
       |                                        |                                 |                                         |
       |                                        |                                 |  axios/node-fetch/request               |
       |                                        |                                 |  + SOCKS5 (Tor) при необходимости       |
       |                                        |                                 |-------------------------------> [Ноды Pocketnet RPC/WS]
       |                                        |                                 |-------------------------------> [Peertube/CDN/Translate]
       |                                        |                                 |                                         |
       |<------------------ ответ по IPC -------|                                 |                                         |
       |                                        |                                 |                                         |
       | 2) fetch() обычный                     | intercept 'fetch'                |                                         |
       |--------------------------------------->| AltTransportActive?              |                                         |
       |                                        |---- yes ----> ExtendedFetch ---->| node-fetch (+tor agent)                 |
       |                                        |---- no -----> обычный fetch ---->| (main не участвует)                     |
       |                                        |                                 |-------------------------------> [HTTP(S) хост] 
       |<------------------- Response ----------|                                 |                                         |
       |                                        | swBroadcaster: network-stats -->| (лог/метрики)                           |
```
