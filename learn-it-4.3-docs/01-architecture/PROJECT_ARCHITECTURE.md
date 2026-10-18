# Архитектура проекта

**Версия пакета:** Learn-it 4.3  
**Дата:** 2026-09-27

## 1. Назначение

Документ фиксирует границы компонентов проекта и направление потоков данных. Детальные правила вынесены в специализированные документы.

## 2. Основные контуры

Проект Learn-it состоит из четырёх независимых контуров:

1. создание и публикация учебных материалов (сайты классов и главная learn-it.app);
2. локальные файлы, создаваемые учеником;
3. телеметрия прохождения тренажёров;
4. отправка результата учителю (`result_submitted`).

Сбой контуров 3 и 4 не должен делать материал недоступным.

## 3. Контур публикации

```text
локальные source-папки курсов
        ↓
sources.local.json
        ↓
scripts/sync.js --prune
        ↓
target-папки общего репозитория
        ↓
scripts/build-catalog.js + templates/index.html + sites.json
        ↓
<course>/catalog.json, <course>/index.html
        ↓
scripts/build-home.js + templates/home.html + sites.json
        ↓
home/index.html
        ↓
git push → GitHub (antlogin/My-cources-catalog, ветка main)
        ↓
GitHub Actions: .github/workflows/deploy-yandex.yml
        ↓
scripts/deploy-yandex.sh
        ↓
Yandex Object Storage: бакет на каждый класс + бакет главной
        ↓
https://<сайт>.learn-it.app, https://learn-it.app
```

### Роли компонентов

- `sources.local.json` — локальное соответствие source → target; в Git не коммитится.
- `scripts/sync.js` — копирует только разрешённые публичные форматы, удаляет устаревшие управляемые файлы при `--prune`; служебное учителя (`LOCAL_*`, папки `local*`/`_local*`) не копирует.
- `sites.json` — перечень классов: папка (`target`), заголовок, подзаголовок и имя сайта (`netlifySite`, при необходимости `subdomain`). Из имени сайта получается адрес `<имя>.learn-it.app` и имя бакета.
- `scripts/build-catalog.js` — читает метаданные HTML, создаёт `catalog.json` и статический `index.html` каждого класса.
- `templates/index.html` — общий шаблон страницы класса.
- `scripts/build-home.js` + `templates/home.html` — главная learn-it.app, см. [HOME_PAGE_SPEC.md](../03-catalog/HOME_PAGE_SPEC.md).
- GitHub — источник публикуемых папок.
- GitHub Actions — единственный штатный способ публикации; секреты Yandex Cloud хранятся только там.
- Yandex Object Storage — статический хостинг готовых папок, без сборки на стороне хостинга.
- Porkbun DNS + Certificate Manager — домен и HTTPS, см. [YANDEX_CLOUD_INFRASTRUCTURE.md](../06-infrastructure/YANDEX_CLOUD_INFRASTRUCTURE.md).

Хостинг не выполняет синхронизацию и сборку: всё собирается локально командой `npm run update` и коммитится.

### Адреса

| Что | Бакет | Адрес |
|---|---|---|
| Главная | `learn-it.app` | `https://learn-it.app` |
| Перенаправление | `www.learn-it.app` | `https://www.learn-it.app` → главная |
| Класс | `<сайт>.learn-it.app` | например `https://phys-9-class.learn-it.app` |

## 4. Контур каталога

```text
HTML-файлы курса
        ↓ catalog:* metadata
build-catalog.js
        ├── catalog.json
        └── index.html с готовым списком материалов
```

`index.html` должен оставаться полезным без JavaScript. Основные ссылки — обычные `<a href>`. Поиск и фильтры — необязательное улучшение.

## 5. Контур Legacy

```text
material.html
  └── catalog:legacy="material_Legacy.html"

material_Legacy.html
  └── catalog:hidden="true"
```

Основной материал создаёт одну запись каталога. Legacy — техническая альтернатива и отдельной записью не является.

## 6. Контур ученического файла

```text
тренажёр
    ↓
формирование Blob / текста / JSON / иного результата
    ↓
сохранение средствами браузера на устройстве ученика
```

Netlify Forms не используются. Если учитель должен получить результат, страница дополнительно отправляет событие `result_submitted` в Telemetry API (раздел 7a). Полноценный upload произвольных файлов, если он понадобится, проектируется как отдельная подсистема с отдельным API, хранилищем и правилами доступа.

## 7. Контур телеметрии

```text
тренажёр
        ↓ POST /api/v1/events
Yandex API Gateway
        ↓
Cloud Function
        ↓
YDB events
```

Тренажёр знает только публичный HTTP-контракт. Он не зависит от схемы YDB и не содержит credentials Yandex Cloud.

Текущая схема чтения:

```text
просмотрщик учителя (LOCAL_…)
        ↓ GET /api/v1/events + Authorization: Bearer <ключ учителя>
API Gateway → Cloud Function → YDB
```

GET и удаление попытки (`DELETE /api/v1/attempts/{attemptId}`) доступны только с ключом учителя. GET отдаёт до 5000 событий и поддерживает фильтры `trainerId`, `since`, `compact`, `limit`. Код функции хранится в `telemetry-function/` и публикуется workflow `deploy-telemetry.yml`. Подробно — [TELEMETRY_API_AND_BACKEND.md](../05-telemetry/TELEMETRY_API_AND_BACKEND.md).

## 7a. Контур отправки результата учителю

```text
страница с формой результата
        ↓ cloudSubmit(CloudForm)
POST /api/v1/events, одно событие result_submitted
        ↓
тот же API Gateway → Cloud Function → YDB events
```

Заменяет прежние Netlify Forms. Формат события — [TRAINER_TELEMETRY_SPEC.md](../05-telemetry/TRAINER_TELEMETRY_SPEC.md), раздел 30.

## 8. Источники истины

Для опубликованного учебного контента источником истины до синхронизации является локальная source-папка курса.

Для состава каталога источником являются HTML-метаданные и фактическое наличие файлов в target после синхронизации.

Для прохождения тренажёра источником истины является сырой упорядоченный event log. Производные показатели должны вычисляться из него, а не заменять его.

## 9. Границы безопасности

В публичный HTML нельзя помещать:

- ключ сервисного аккаунта;
- OAuth/IAM токены;
- access key / secret key;
- прямые credentials YDB;
- ключ учителя (`TEACHER_TOKEN`);
- иные секреты, дающие доступ к инфраструктуре.

Ключи публикации (статический ключ и авторизованный ключ сервисного аккаунта) хранятся только в секретах GitHub Actions и никогда не коммитятся.

Публичный URL API Gateway не является секретом и может находиться в клиентском коде.

Материалы только для учителя (ключи ответов, варианты контрольных, просмотрщики результатов) хранятся в рабочей папке как `LOCAL_*` или в папке `local*`/`_local*` и не попадают ни в репозиторий, ни в бакеты. Бакеты открыты на чтение файлов, но не на листинг.

## 10. Отказоустойчивость

- Недоступность Telemetry API не должна блокировать учебную механику.
- Техническая ошибка сети не должна отображаться как неверный учебный ответ.
- Событие не удаляется из очереди до подтверждённой успешной отправки.
- Повторная отправка с теми же `(attemptId, seq)` должна быть безопасна.

## 11. Где искать детали

- каталог и синхронизация: [CATALOG_SPEC.md](../03-catalog/CATALOG_SPEC.md);
- HTML-материал: [HTML_MATERIAL_SPEC.md](../02-materials/HTML_MATERIAL_SPEC.md);
- публикация: [PUBLISHING_WORKFLOW.md](../04-publishing/PUBLISHING_WORKFLOW.md);
- события тренажёра: [TRAINER_TELEMETRY_SPEC.md](../05-telemetry/TRAINER_TELEMETRY_SPEC.md);
- сервер: [TELEMETRY_API_AND_BACKEND.md](../05-telemetry/TELEMETRY_API_AND_BACKEND.md);
- бакеты, домен, сертификат, ключи: [YANDEX_CLOUD_INFRASTRUCTURE.md](../06-infrastructure/YANDEX_CLOUD_INFRASTRUCTURE.md).
