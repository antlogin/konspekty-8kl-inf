# Пакет документации Learn-it 4.3

**Статус:** актуальная рабочая документация проекта  
**Дата фиксации:** 2026-10-14  
**Заменяет:** Learn-it 4.2 (2026-10-12)

## 1. Назначение

Этот пакет — единый источник правил проекта **Learn-it**: учебные сайты по классам, главная страница learn-it.app, учебные HTML-материалы, тренажёры и сбор результатов.

Версия 4.0 возвращает проекту имя Learn-it и фиксирует переезд публикации с Netlify в Yandex Cloud. Промежуточная схема v1.x («Каталог курса», отдельный Netlify-проект на каждый класс) заменена одной инфраструктурой на домене `learn-it.app`.

Версия 4.1 добавляет правила оформления и стиля материалов ([STYLE_GUIDE.md](02-materials/STYLE_GUIDE.md)) и фиксирует изменения 05–10.10.2026: служебные файлы учителя не публикуются, листинг бакетов закрыт, телеметрия читается только с ключом учителя, функция телеметрии публикуется из репозитория. Подробно — [CHANGELOG.md](CHANGELOG.md).

Версия 4.2 вносит правки по итогам сборки занятия 5 (физика, 7 класс): двухколоночные задания, правило баллов и событие `answers_checked`, рисунки приборов, блок «План занятия». Подробно — [CHANGELOG.md](CHANGELOG.md).

Версия 4.3 вводит стандарт навигации ([NAVIGATION_SPEC.md](03-catalog/NAVIGATION_SPEC.md)): каталог курса строится по конспектам с фиксированными порядковыми номерами, новые сверху; тренажёры и другие материалы показываются внутри строки своего конспекта; в каждом материале есть строка пути «learn-it.app › курс › номер». Реализация в скриптах — следующий этап.

Learn-it 4.x охватывает пять связанных контуров:

```text
создание HTML-материала
        ↓
локальная синхронизация и генерация каталогов + главной
        ↓
git push → GitHub Actions → Yandex Object Storage
        ↓
https://learn-it.app (главная) и https://<сайт>.learn-it.app (классы)

тренажёр
        ├── файл ученика → локально на устройстве
        ├── результат для учителя → result_submitted → Telemetry API
        └── события попытки → Telemetry API → Yandex Cloud → YDB
```

Главный принцип пакета: нормативные правила отделены от истории внедрения. Одноразовые патчи и журналы миграции в пакет не входят.

## 2. Структура пакета

```text
learn-it-4.3/
├── README.md
├── CHANGELOG.md
├── 01-architecture/
│   ├── PROJECT_ARCHITECTURE.md
│   └── RESULTS_AND_FILES_ARCHITECTURE.md
├── 02-materials/
│   ├── HTML_MATERIAL_SPEC.md
│   ├── MATERIAL_CREATION_GUIDE.md
│   ├── STYLE_GUIDE.md
│   └── design_project_template.html
├── 03-catalog/
│   ├── CATALOG_SPEC.md
│   ├── HOME_PAGE_SPEC.md
│   ├── LEGACY_BROWSER_SUPPORT.md
│   └── NAVIGATION_SPEC.md
├── 04-publishing/
│   ├── PUBLISHING_WORKFLOW.md
│   └── ADD_NEW_COURSE.md
├── 05-telemetry/
│   ├── TRAINER_TELEMETRY_SPEC.md
│   ├── TELEMETRY_API_AND_BACKEND.md
│   └── TELEMETRY_INTEGRATION_GUIDE.md
└── 06-infrastructure/
    └── YANDEX_CLOUD_INFRASTRUCTURE.md
```

## 3. Что является источником истины

| Задача | Основной документ |
|---|---|
| Общая архитектура проекта | [PROJECT_ARCHITECTURE.md](01-architecture/PROJECT_ARCHITECTURE.md) |
| Файлы ученика, результаты и границы подсистем | [RESULTS_AND_FILES_ARCHITECTURE.md](01-architecture/RESULTS_AND_FILES_ARCHITECTURE.md) |
| Нормативные требования к учебной HTML-странице | [HTML_MATERIAL_SPEC.md](02-materials/HTML_MATERIAL_SPEC.md) |
| Короткая инструкция для создания нового материала | [MATERIAL_CREATION_GUIDE.md](02-materials/MATERIAL_CREATION_GUIDE.md) |
| Вёрстка текста, язык, термины, заголовки, задания, формулы, бумажные листы | [STYLE_GUIDE.md](02-materials/STYLE_GUIDE.md) |
| Каталог класса: `catalog.json`, `index.html`, `sync.js` | [CATALOG_SPEC.md](03-catalog/CATALOG_SPEC.md) |
| Главная страница learn-it.app | [HOME_PAGE_SPEC.md](03-catalog/HOME_PAGE_SPEC.md) |
| Структура каталога курса, нумерация конспектов, навигация по сайту | [NAVIGATION_SPEC.md](03-catalog/NAVIGATION_SPEC.md) |
| Создание Legacy-версии | [LEGACY_BROWSER_SUPPORT.md](03-catalog/LEGACY_BROWSER_SUPPORT.md) |
| Обычная публикация изменений | [PUBLISHING_WORKFLOW.md](04-publishing/PUBLISHING_WORKFLOW.md) |
| Подключение нового курса | [ADD_NEW_COURSE.md](04-publishing/ADD_NEW_COURSE.md) |
| Контракт телеметрии тренажёра | [TRAINER_TELEMETRY_SPEC.md](05-telemetry/TRAINER_TELEMETRY_SPEC.md) |
| Сервер телеметрии: API Gateway, функция, YDB | [TELEMETRY_API_AND_BACKEND.md](05-telemetry/TELEMETRY_API_AND_BACKEND.md) |
| Подключение телеметрии к новому тренажёру | [TELEMETRY_INTEGRATION_GUIDE.md](05-telemetry/TELEMETRY_INTEGRATION_GUIDE.md) |
| Бакеты, домен, сертификат, DNS, ключи | [YANDEX_CLOUD_INFRASTRUCTURE.md](06-infrastructure/YANDEX_CLOUD_INFRASTRUCTURE.md) |

## 4. Текущее состояние подсистем

| Возможность | Статус 4.3 |
|---|---|
| Публикация в Yandex Object Storage через GitHub Actions | используется |
| Главная `https://learn-it.app` | используется, собирается `build-home.js` |
| Адреса классов `https://<сайт>.learn-it.app` | используются, одна DNS-запись `*` на все |
| HTTPS: сертификат Let's Encrypt на `learn-it.app` и `*.learn-it.app` | выпущен, продлевается автоматически |
| `www.learn-it.app` | перенаправляет на `https://learn-it.app` |
| Netlify-проекты классов | больше не основной канал; подлежат отключению |
| `sync.js --prune` и генерация каталогов | используется |
| Белый список `.html`, `.pdf`, изображений | используется |
| Служебное учителя: файлы `LOCAL_*`, папки `local*`/`_local*` | не синхронизируется, не коммитится, не публикуется |
| Листинг бакетов | закрыт, файлы читаются публично |
| Генерируемый `index.html` без обязательного JavaScript | реализован |
| `catalog:hidden`, `catalog:legacy`, плашка `HTML | lite` | реализованы |
| Каталог по конспектам с фиксированными номерами, новые сверху | стандарт утверждён, реализация — следующий этап |
| Строка пути в материалах, ссылка «Последний» на главной | стандарт утверждён, реализация — следующий этап |
| Файлы, создаваемые учеником | сохраняются локально |
| Отправка результата учителю (`result_submitted`) | реализована вместо Netlify Forms |
| Netlify Forms | не используется |
| `POST /api/v1/events` | реализован, без ключа |
| `GET /api/v1/events` с фильтрами `trainerId`, `since`, `compact`, `limit` | реализован, только с ключом учителя |
| `DELETE /api/v1/attempts/{attemptId}` | реализован, только с ключом учителя |
| Деплой функции телеметрии и API Gateway из репозитория | используется, со смоук-проверкой и откатом |
| YDB `events`, идемпотентность `(attempt_id, seq)` | используется |
| YDB `attempts` | создана, пока не заполняется |
| Устойчивая очередь IndexedDB | следующий этап |
| Авторизация преподавателя на чтение | реализована: один ключ учителя (`TEACHER_TOKEN`) |
| Отдельные ключи для разных учителей | следующий этап |

## 5. Краткая архитектура

### Публикация

```text
локальные source-папки
        ↓ npm run update  (sync.js --prune → build-catalog.js → build-home.js)
папки классов + home/ в репозитории antlogin/My-cources-catalog
        ↓ git push в main
GitHub Actions: Deploy to Yandex Cloud
        ↓ scripts/deploy-yandex.sh
бакеты Yandex Object Storage
        ↓ DNS Porkbun + сертификат Certificate Manager
https://learn-it.app, https://phys-9-class.learn-it.app, …
```

### Телеметрия и результаты

```text
HTML-тренажёр
        ↓ HTTPS POST /api/v1/events
Yandex API Gateway → Cloud Function → YDB events
```

## 6. Как пользоваться документацией

Для обычного конспекта достаточно начать с [MATERIAL_CREATION_GUIDE.md](02-materials/MATERIAL_CREATION_GUIDE.md) и [STYLE_GUIDE.md](02-materials/STYLE_GUIDE.md); при спорном техническом вопросе приоритет имеет `HTML_MATERIAL_SPEC.md`, по вёрстке текста и языку — `STYLE_GUIDE.md`.

Для теста или тренажёра дополнительно обязательны `TRAINER_TELEMETRY_SPEC.md` и `TELEMETRY_INTEGRATION_GUIDE.md`.

Для изменений публикации, домена, сертификата или ключей — `PUBLISHING_WORKFLOW.md` и `YANDEX_CLOUD_INFRASTRUCTURE.md`.

## 7. Версионирование

Версия относится ко всему пакету, имена файлов номера версии не содержат. Нумерация 4.x продолжает линию Learn-it. Предыдущие версии хранятся как история: `Docs/learn-it-docs-4.2-2026-10-12.zip`, `Docs/learn-it-docs-4.1-2026-10-11.zip`, `Docs/learn-it-docs-4.0.zip`, `Docs/course-docs-v1.5.zip` (промежуточная схема «Каталог курса»), более ранние — в `Docs/Archive---docs.zip`.
