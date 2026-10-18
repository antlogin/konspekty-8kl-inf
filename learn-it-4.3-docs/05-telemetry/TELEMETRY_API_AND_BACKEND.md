# Telemetry API и текущая серверная реализация

**Версия пакета документации:** Learn-it 4.3  
**Дата фиксации инфраструктуры:** 2026-10-10  
**Статус:** POST, GET и DELETE через API Gateway работают; GET и DELETE требуют ключ учителя; `events` используется; `attempts` создана, но пока не заполняется текущей функцией. Код функции и спецификация шлюза хранятся в репозитории (`telemetry-function/`) и публикуются автоматически.

## 1. Архитектура

```text
Browser trainer
    ↓ HTTPS
Yandex API Gateway
    ↓
Cloud Function
    ↓
YDB
```

Текущая одна Cloud Function обслуживает:

```text
POST   /api/v1/events                  приём событий из тренажёров, без ключа
GET    /api/v1/events                  чтение событий, только с ключом учителя
DELETE /api/v1/attempts/{attemptId}    удаление попытки, только с ключом учителя
```

## 2. Публичный endpoint

Base URL:

```text
https://d5d3qbcrq94lchv37arh.cmxivbes.apigw.yandexcloud.net
```

Telemetry URL:

```text
https://d5d3qbcrq94lchv37arh.cmxivbes.apigw.yandexcloud.net/api/v1/events
```

Публичный URL допустимо хранить в тренажёре.

## 3. Инфраструктурные идентификаторы

```text
Yandex Cloud folder: trainer-telemetry
Database: trainer-telemetry-db
Cloud Function: trainer-telemetry-ingest
Cloud Function ID: d4elbq5v8leq2vqpphr5
Service account: trainer-telemetry-writer
Service Account ID: ajeo1upeqnrrvroilo0d
API Gateway: trainer-telemetry-api
```

Это идентификаторы, а не секретные ключи.

## 4. Секреты

В текущем клиентском контракте не используются:

- service-account key;
- OAuth token;
- IAM token;
- YDB login/password;
- access key / secret key.

Ключи сервисного аккаунта для рабочей Cloud Function не требуются: используется metadata authentication.

### Ключ учителя

- Чтение (`GET /api/v1/events`) и удаление (`DELETE /api/v1/attempts/{attemptId}`) требуют заголовок `Authorization: Bearer <ключ учителя>`. Без ключа или с неверным ключом — `403 {"ok":false,"error":"forbidden"}`.
- Ключ — 64 шестнадцатеричных символа в переменной окружения `TEACHER_TOKEN` функции. Если переменная не задана, GET и DELETE запрещены всегда.
- Ключ сравнивается за постоянное время (`crypto.timingSafeEqual`).
- Значение можно посмотреть в консоли Yandex Cloud: функция `trainer-telemetry-ingest` → последняя версия → переменные окружения. Копия учителя хранится вне репозитория.
- Ключ переносится из версии в версию при каждом деплое (раздел 10). Смена ключа: задать новое значение `TEACHER_TOKEN` в версии функции; следующие деплои перенесут его.
- Ключ вводится только в просмотрщиках результатов учителя (раздел 15). В публичные конспекты и тренажёры его вставлять нельзя: они открыты всем.
- `POST /api/v1/events` ключа не требует, тренажёры менять не нужно.

## 5. YDB

```text
Type: Serverless
Workload: OLTP
Provisioned throughput: 10 RU/s
Dedicated throughput: 0 RU/s
Data limit: 50 GB
Deletion protection: enabled
```

Connection parameters:

```text
YDB_ENDPOINT = grpcs://ydb.serverless.yandexcloud.net:2135
YDB_DATABASE = /ru-central1/b1gau3gh9inb8pgfj05m/etnf8rtj4h2tj91rvql1
```

## 6. Таблица `events`

```sql
CREATE TABLE events (
    attempt_id Utf8 NOT NULL,
    seq Uint64 NOT NULL,
    received_at Timestamp NOT NULL,
    trainer_id Utf8 NOT NULL,
    event_type Utf8 NOT NULL,
    payload_json Json NOT NULL,

    PRIMARY KEY (attempt_id, seq)
);
```

Назначение:

- хранить каждое событие отдельно;
- иметь серверное `received_at`;
- сохранять оригинальный JSON события;
- обеспечить идемпотентность `(attempt_id, seq)`.

## 7. Таблица `attempts`

```sql
CREATE TABLE attempts (
    attempt_id Utf8 NOT NULL,

    trainer_id Utf8 NOT NULL,
    trainer_version Utf8 NOT NULL,
    schema_version Uint32 NOT NULL,

    started_at Timestamp NOT NULL,
    finished_at Timestamp,

    status Utf8 NOT NULL,

    first_name Utf8,
    last_name Utf8,
    class_name Utf8,

    subject_id Utf8,
    course_id Utf8,
    school_id Utf8,

    summary_json Json,

    PRIMARY KEY (attempt_id)
);
```

Таблица уже создана. Текущая функция пишет только `events`. Плановое назначение `attempts` — быстрый список попыток, фильтры, статус и summary; сырой event log всё равно остаётся источником истины.

## 8. Cloud Function

```text
Name: trainer-telemetry-ingest
Runtime: Node.js 22
Entry point: index.handler
Timeout: 30 s
Memory: 256 MB
Service account: trainer-telemetry-writer
Network: not selected
Logging: enabled
```

Роли:

```text
ydb.editor                 — доступ сервисного аккаунта к базе
functions.functionInvoker  — вызов функции через API Gateway
```

Environment:

```text
YDB_ENDPOINT
YDB_DATABASE
TEACHER_TOKEN   — ключ учителя (раздел 4)
```

Значения задаёт workflow деплоя (раздел 10), вручную их менять не нужно.

## 9. Код функции и спецификация шлюза

Источник истины — папка `telemetry-function/` в репозитории:

```text
telemetry-function/index.js          код функции (POST, GET с фильтрами, DELETE)
telemetry-function/package.json      версия функции и зависимости @ydbjs/*
telemetry-function/api-gateway.yaml  спецификация API Gateway trainer-telemetry-api
```

Копии кода в документацию не переносятся, чтобы они не расходились с рабочей версией. На 2026-10-10 функция и спецификация шлюза имеют версию 1.3.0.

ID попытки в DELETE берётся из `pathParameters.attemptId`: в `event.path` API Gateway передаёт шаблон пути, а не настоящий адрес. Запасной вариант — разбор `event.url`.

## 10. Деплой функции и шлюза

`.github/workflows/deploy-telemetry.yml` (**Deploy telemetry function**):

- запускается при push в `main` с изменениями в `telemetry-function/` или в самом workflow, а также вручную (Actions → Deploy telemetry function → Run workflow);
- работает с секретом `YC_SA_KEY_JSON` (сервисный аккаунт `claude-admin`); `folder-id` задаётся явно, иначе `yc` 1.40 завершается с ошибкой.

Шаги:

1. Запомнить текущую версию функции (тег `$latest`), её `TEACHER_TOKEN` и текущую спецификацию шлюза. Если ключа нет (первый запуск), создать новый (`openssl rand -hex 32`). В лог ключ не выводится.
2. Создать новую версию функции из `telemetry-function/` с параметрами раздела 8.
3. Обновить шлюз из `telemetry-function/api-gateway.yaml`.
4. Смоук-проверка: GET без ключа → 403, GET с ключом → `ok: true`, POST тестового события (`trainerId=deploy-smoke-test`), DELETE без ключа → 403, DELETE с ключом → 200, контрольный GET — событий тестовой попытки не осталось.
5. Если проверка не прошла: вернуть тег `$latest` на прежнюю версию и вернуть шлюзу прежнюю спецификацию.

Ход деплоя: GitHub → Actions → **Deploy telemetry function**.

## 11. API Gateway

Спецификация — `telemetry-function/api-gateway.yaml` (раздел 9). Кратко:

```text
GET    /api/v1/events                → функция; 200, 403, 500
POST   /api/v1/events                → функция; 200, 400, 500
DELETE /api/v1/attempts/{attemptId}  → функция; 200, 400, 403, 500
```

CORS: `origin: "*"`, методы `GET, POST, DELETE`, заголовки `Content-Type, Authorization`. Ответ 405 перечисляет `GET, POST, DELETE`.

## 12. POST contract на сервере

Сервер проверяет минимум:

```text
schemaVersion — integer
attemptId     — непустая string
trainerId     — непустая string
events        — непустой array, максимум 200
```

Для каждого события проверяется:

```text
seq — integer >= 1
eventType — непустая string
```

Каждое событие сохраняется через `UPSERT`.

Успешный ответ:

```json
{
  "ok": true,
  "schemaVersion": 1,
  "attemptId": "uuid",
  "stored": 25
}
```

## 13. GET contract

```http
GET /api/v1/events?trainerId=…&since=…&compact=1&limit=…
Authorization: Bearer <ключ учителя>
```

Без ключа или с неверным ключом — `403 {"ok":false,"error":"forbidden"}`.

Необязательные параметры:

```text
trainerId=<id>        только события этого тренажёра
since=<ISO-время>     только события, полученные сервером позже этого момента
compact=1             без служебных событий (heartbeat старше 3 минут, движения окна, ввод в полях и т. п.)
limit=<1..5000>       максимум строк, по умолчанию 5000
```

Без параметров отдаются 5000 последних событий, отсортированных по `received_at` по убыванию.

Пример: `GET /api/v1/events?trainerId=informatics-11-linux-terminal-review-lesson-2026-10&compact=1&since=2026-10-07T10:00:00Z`.

Ответ:

```json
{
  "ok": true,
  "count": 147,
  "events": [
    {
      "attempt_id": "...",
      "seq": 1,
      "received_at": "...",
      "trainer_id": "...",
      "event_type": "...",
      "payload_json": {}
    }
  ]
}
```

Группировка попыток выполняется клиентским просмотрщиком учителя.

## 13.1. DELETE contract

```http
DELETE /api/v1/attempts/{attemptId}
Authorization: Bearer <ключ учителя>
```

Удаляет все события одной попытки из таблицы `events`.

```text
200 {"ok":true,"attemptId":"…","deleted":true}
400 пустой или слишком длинный (> 200 символов) attemptId
403 {"ok":false,"error":"forbidden"} без ключа или с неверным ключом
```

## 14. Группировка для преподавателя

Рекомендуемая иерархия:

```text
trainerId
  ↓
дата прохождения
  ↓
studentId
или ФИО + класс
или attemptId
  ↓
попытки
  ↓
события
```

Экспорт должен позволять получить JSON одной попытки и, позднее, набор попыток ученика по конкретному тренажёру/дате.

## 15. Как учителю смотреть результаты

### Просмотрщики результатов

Просмотрщик — локальный HTML-файл учителя, который читает `GET /api/v1/events` с ключом учителя. Он открывается двойным щелчком и не публикуется.

- `LOCAL_trig-11-results.html` — попытки одного тренажёра: ученик, баллы, процент, время, уходы со страницы, итог по темам; щелчок по строке раскрывает ответы по вопросам. Есть фильтр «с даты», выгрузка CSV, поле `trainerId` (можно вписать другой тренажёр) и поле «Ключ учителя» (хранится только в этом браузере).
- Монитор урока 05 курса JavaScript — ключ вводится в «Настройки сервера» → «Ключ учителя».

Правила:

- просмотрщик всегда называется `LOCAL_…` — с подчёркиванием. Файл `LOCAL-…` с дефисом правило не ловит, и он публикуется;
- любой новый просмотрщик отправляет `Authorization: Bearer <ключ>` на GET, иначе получает 403;
- ключ хранится только в браузере учителя, в файл просмотрщика не вписывается.

### Консоль YDB

Console → YDB → `trainer-telemetry-db` → «Навигация» → «Новый SQL-запрос»:

```sql
SELECT received_at, trainer_id, event_type, attempt_id
FROM events
ORDER BY received_at DESC
LIMIT 20;
```

Вся попытка целиком:

```sql
SELECT seq, received_at, event_type, payload_json
FROM events
WHERE attempt_id = "<attemptId>"
ORDER BY seq;
```

Время в базе хранится в UTC. Таблица `attempts` пустая — это нормально: функция её пока не заполняет.

## 16. Текущие ограничения

На 2026-10-10 зафиксировано:

1. GET возвращает максимум 5000 событий за запрос; пагинации нет.
2. Таблица `attempts` не заполняется текущей функцией.
3. Ключ учителя один на всех учителей.
4. В событиях хранятся имена и фамилии учеников; доступ к ним закрыт ключом учителя.
5. CORS открыт для любого origin.
6. Аналитика поведения на сервере не выполняется.

Выполнено: серверные фильтры (`trainerId`, `since`, `compact`, `limit`), авторизация учителя для GET и DELETE, закрытие публичного чтения.

Следующий серверный этап:

```text
attempts population
→ pagination/indexes
→ отдельные ключи учителей
```

## 17. Архитектурная граница

Даже при изменении YDB, Cloud Functions или облачного провайдера опубликованный тренажёр не должен меняться, если сохраняются публичный URL/маршрут и JSON-контракт либо предоставляется совместимый endpoint.

Стабильный клиентский контракт описан отдельно в [TRAINER_TELEMETRY_SPEC.md](TRAINER_TELEMETRY_SPEC.md).
