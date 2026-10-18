# Спецификация телеметрии тренажёра

**Версия контракта:** schemaVersion 1  
**Версия документа в пакете:** Learn-it 4.3  
**Назначение:** стабильный клиентский контракт, независимый от Yandex Cloud и физического хранилища.

## 1. Основной принцип

Тренажёр моделирует:

1. попытку (`attempt`);
2. упорядоченный поток событий;
3. фактический учебный результат.

Сырые события — источник истины. Аналитика строится позднее и не должна уничтожать исходный event log.

## 2. Публичный транспортный контракт

Клиент отправляет:

```text
POST /api/v1/events
```

Текущий полный публичный URL приведён в `TELEMETRY_API_AND_BACKEND.md` и `TELEMETRY_INTEGRATION_GUIDE.md`.

Клиент не должен знать о YDB, Cloud Function или сервисном аккаунте.

## 3. Версии

Используются независимые поля:

```text
schemaVersion   — версия общего обменного формата
eventVersion    — версия конкретного типа/формата события
trainerVersion  — версия конкретного тренажёра
```

Текущий общий формат:

```text
schemaVersion = 1
eventVersion = 1
```

Несовместимое изменение общего контракта требует увеличения `schemaVersion`.

## 4. Идентификация тренажёра

Каждый тренажёр имеет стабильный уникальный `trainerId`.

Он должен различать отдельные учебные назначения. Например урок и домашнее задание с похожими вопросами получают разные `trainerId`.

Рекомендуемый формат:

```text
<subject>-<class>-<topic>-<purpose>-<date-or-version>
```

Пример:

```text
physics-7-pressure-lesson-2026-09-28
```

## 5. Попытка

Каждое новое прохождение получает новый `attemptId`.

Минимальные данные попытки:

```text
attemptId
trainerId
trainerVersion
schemaVersion
startedAt
finishedAt
status
```

Один `attemptId` используется для всех событий одного прохождения.

## 6. `seq`

Каждое событие получает монотонно возрастающий номер:

```text
1, 2, 3, ...
```

`seq` используется для восстановления порядка, retry и идемпотентности.

Серверный логический ключ:

```text
(attemptId, seq)
```

## 7. POST envelope

```json
{
  "schemaVersion": 1,
  "attemptId": "uuid",
  "trainerId": "trainer-id",
  "events": [
    {
      "seq": 1,
      "eventType": "attempt_started"
    }
  ]
}
```

`attemptId` обязателен на уровне пакета. Внутри каждого события он не является обязательным полем текущего серверного контракта; локальный полный JSON попытки может хранить его на верхнем уровне.

## 8. Событие

```json
{
  "seq": 1,
  "eventType": "attempt_started",
  "eventVersion": 1,
  "schemaVersion": 1,
  "clientTime": "2026-09-27T16:50:00.000Z",
  "elapsedMs": 0,
  "trainerId": "physics-7-pressure-lesson-2026-09-28",
  "trainerVersion": "1.0.0",
  "eventSource": "system",
  "context": {
    "pageId": "page-1"
  },
  "data": {}
}
```

Обязательные поля события:

```text
seq
eventType
eventVersion
schemaVersion
clientTime
elapsedMs
trainerId
trainerVersion
eventSource
context
data
```

## 9. `eventSource`

Допустимые базовые значения:

```text
user
browser
timer
navigation
system
```

Примеры:

```text
answer_changed     → user
visibility_hidden  → browser
heartbeat          → timer
page_opened        → navigation
attempt_started    → system
```

## 10. Базовые события

```text
attempt_started
attempt_finished
page_opened
page_left
question_available
question_visible
question_hidden
answer_changed
page_submitted
visibility_hidden
visibility_visible
window_blur
window_focus
idle_started
idle_ended
online
offline
copy
paste
cut
context_menu
heartbeat
```

Новые события можно добавлять без изменения таблицы `events`, если общая оболочка сохраняется совместимой.

## 11. Ответы

`answer_changed` должен хранить полное состояние до и после изменения:

```json
{
  "eventType": "answer_changed",
  "data": {
    "questionId": "q1",
    "controlId": "q1-option-b",
    "previousAnswer": ["A"],
    "answer": ["B"]
  }
}
```

Это правило распространяется на single choice, multiple choice, matching и иные типы: `previousAnswer` и `answer` должны позволять восстановить фактическое состояние.

### Событие `answers_checked`

Проверка страницы оцениваемой работы (правило баллов: [HTML_MATERIAL_SPEC.md](../02-materials/HTML_MATERIAL_SPEC.md), п. 31.5):

```json
{
  "eventType": "answers_checked",
  "eventSource": "user",
  "data": {
    "checkNo": 2,
    "units": [
      { "unitId": "e01.1", "questionId": "e01", "correct": true, "checks": 2, "points": 0.5 }
    ]
  }
}
```

При завершении работы то же событие отправляется с `eventSource: "system"`, `checkNo: null`, `trigger: "finish-button"`.

## 12. Фиксация страницы

Текущий общий механизм использует `page_submitted`.

Пример:

```json
{
  "eventType": "page_submitted",
  "data": {
    "pageId": "page-2",
    "submissionNo": 2,
    "trigger": "next-button"
  }
}
```

Каждое повторное подтверждение страницы имеет новый `submissionNo`, даже если ответы не изменились.

## 13. Видимость вопроса

```text
question_available — вопрос есть на активной странице
question_visible   — вопрос вошёл в viewport
question_hidden    — вопрос вышел из viewport
```

Повторные входы/выходы фиксируются повторно. Для современных тренажёров предпочтителен `IntersectionObserver`; если он недоступен в отдельной Legacy-версии, телеметрия не должна ломать учебный сценарий.

## 14. Visibility, focus и idle

Фиксируются:

```text
visibility_hidden
visibility_visible
window_blur
window_focus
idle_started
idle_ended
```

`visibility_hidden` — наблюдаемый технический факт, а не доказательство причины.

Порог idle является параметром тренажёра; ранняя тестовая реализация использовала 30 секунд, но конкретное значение должно быть осознанно выбрано и при необходимости описано в `data/context` или документации тренажёра.

## 15. Clipboard и context menu

Можно фиксировать:

```text
copy
paste
cut
context_menu
```

Содержимое clipboard не сохранять. При необходимости достаточно технических признаков вроде длины текста.

## 16. Временная модель

`clientTime` — локальная ISO-временная метка события.

`elapsedMs` — время от начала попытки по клиентской модели.

Итоговый локальный JSON может хранить производные:

```text
durationMs
visibleMs
hiddenMs
idleMs
```

После `attempt_finished` итоговые значения должны быть заморожены.

## 17. Heartbeat

Heartbeat служит для восстановления состояния между редкими действиями и диагностики связи.

Пример:

```json
{
  "visible": true,
  "online": true,
  "idle": false
}
```

Интервал — параметр клиента; ранняя тестовая версия использовала около 15 секунд. Нельзя делать heartbeat настолько частым, чтобы он создавал ненужный объём данных.

## 18. Очередь

Каждое сформированное событие сначала сохраняется в локальной очереди:

```js
const pendingEvents = [];
```

Удалять событие до подтверждения сервера запрещено.

## 19. Пакетная отправка

Клиент не делает отдельный HTTP request на каждое событие.

Рабочая рекомендация:

```text
10–25 событий за пакет
```

Текущий сервер принимает максимум:

```text
200 событий за один POST
```

## 20. Когда отправлять

Рекомендуемые триггеры:

```text
каждые 10 секунд
очередь >= 10 событий
visibility hidden / pagehide, когда возможно
online после offline
attempt_finished
```

## 21. Retry

При сетевой/серверной ошибке пакет остаётся в очереди. Следующая попытка использует те же `attemptId` и `seq`.

Серверная идемпотентность позволяет безопасно повторять пакет.

## 22. Устойчивая очередь

Текущая минимальная реализация может держать `pendingEvents` в памяти.

Целевая более надёжная реализация:

```text
новое событие
→ IndexedDB
→ POST
→ подтверждение сервера
→ удалить подтверждённые события из IndexedDB
```

IndexedDB пока не является обязательной частью текущей минимальной реализации, но является рекомендованным следующим этапом.

## 23. Завершение попытки

Порядок:

```text
1. зафиксировать ответы текущей страницы
2. page_submitted
3. attempt_finished
4. остановить таймеры
5. заморозить итоговые показатели
6. отправить остаток очереди
7. показать итог пользователю
```

## 24. Данные ученика

Текущий рекомендуемый объект:

```js
const student = {
  firstName: "",
  lastName: "",
  className: "",
  studentId: null
};
```

Поля можно передать в `data` события `attempt_started`.

## 25. Локальный JSON

Рекомендуемая структура:

```json
{
  "schemaVersion": 1,
  "trainerId": "...",
  "trainerVersion": "...",
  "attemptId": "...",
  "student": {
    "firstName": "...",
    "lastName": "...",
    "className": "..."
  },
  "startedAt": "...",
  "finishedAt": "...",
  "summary": {},
  "items": [],
  "events": []
}
```

В каждый элемент `items` оцениваемой работы добавляются поля:

```text
checks     — номер последней проверки
points     — начисленные баллы
maxPoints  — максимум за элемент: 1 для пары, число верных вариантов для задания с выбором
```

## 26. Что не собирать по умолчанию

Не фиксировать без специальной причины:

- каждое движение мыши;
- каждый pixel scroll;
- каждое нажатие клавиши;
- содержимое clipboard;
- произвольные высокочастотные события без учебной цели.

## 27. Что не должен делать клиент

Клиент не должен:

- подключаться напрямую к YDB;
- содержать ключ сервисного аккаунта или ключ учителя;
- зависеть от физической схемы YDB;
- удалять сырой event log после построения summary;
- вычислять `cheating`, `suspicionScore`, `riskScore` как встроенную оценку поведения.

## 28. Совместимость

Новые данные предпочтительно добавлять в `context` и `data`.

Существующие поля нельзя несовместимо переопределять без новой `schemaVersion`.

## 29. Минимальный checklist

```text
[ ] trainerId уникален для назначения
[ ] trainerVersion задан
[ ] schemaVersion = 1
[ ] eventVersion = 1
[ ] новый attemptId на каждое прохождение
[ ] seq начинается с 1
[ ] seq строго возрастает
[ ] attempt_started создаётся
[ ] ответы фиксируются согласно механике
[ ] page_submitted фиксирует подтверждение страницы
[ ] attempt_finished создаётся
[ ] локальный JSON доступен
[ ] pendingEvents сохраняется при ошибке
[ ] retry использует тот же attemptId + seq
[ ] пакет удаляется только после HTTP 200 + ok=true
[ ] API failure не блокирует учебную механику
[ ] секретов Yandex Cloud в клиенте нет
```

## 30. Событие `result_submitted`

Используется страницами, которые передают учителю итоговый результат или файл (замена Netlify Forms). Отправляется функцией `cloudSubmit` одним запросом:

```json
{
  "schemaVersion": 1,
  "attemptId": "form-<session_id или случайный id>",
  "trainerId": "<form-name>:<trainer_id или lesson>",
  "events": [
    {
      "seq": 1,
      "eventType": "result_submitted",
      "clientTime": "2026-10-04T12:00:00.000Z",
      "pageUrl": "https://info-7-class.learn-it.app/…",
      "data": {
        "fields": { "form-name": "…", "student": "…", "…": "…" },
        "files": [
          { "field": "file", "name": "result.zip", "size": 1234, "content": { "…": "JSON из ZIP" } }
        ]
      }
    }
  ]
}
```

Правила:

- `fields` — все текстовые поля формы как строки;
- ZIP с одним несжатым файлом распаковывается, его JSON кладётся в `content`; иначе файл передаётся в `base64`; при ошибке чтения — `"error": "read_failed"`;
- это событие короче базового (нет `eventVersion`, `elapsedMs` и др.): оно описывает разовую отправку формы, а не шаг попытки;
- успех — HTTP 2xx и `{"ok": true}`; иначе ученику показывается сообщение и предлагается сохранить файл локально;
- тайм-аут запроса 20 с;
- большие файлы этим способом не передавать;
- в оцениваемых работах `result_submitted` отправляется автоматически после завершения работы, без отдельной кнопки. Рядом с итогом показывается отметка: «Ответы переданы учителю» при успехе или сообщение с предложением сохранить файл при ошибке.
