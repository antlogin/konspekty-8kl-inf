# Подключение телеметрии к новому тренажёру

**Версия пакета:** Learn-it 4.3  
**Цель:** практический пошаговый шаблон для нового автономного HTML/JS-тренажёра.

Полный контракт: [TRAINER_TELEMETRY_SPEC.md](TRAINER_TELEMETRY_SPEC.md). Серверные детали: [TELEMETRY_API_AND_BACKEND.md](TELEMETRY_API_AND_BACKEND.md).

## 1. Задать конфигурацию

```js
const TELEMETRY_CONFIG = {
  schemaVersion: 1,
  eventVersion: 1,
  trainerId: "physics-7-pressure-lesson-2026-09-28",
  trainerVersion: "1.0.0",
  subjectId: "physics",
  courseId: "7-physics",
  schoolId: null,
  apiUrl: "https://d5d3qbcrq94lchv37arh.cmxivbes.apigw.yandexcloud.net/api/v1/events"
};
```

`trainerId` должен быть уникален для конкретного назначения.

## 2. Создать данные попытки

```js
function createAttemptId() {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return (
    Date.now().toString(36) + "-" +
    Math.random().toString(36).slice(2) + "-" +
    Math.random().toString(36).slice(2)
  );
}

const attemptId = createAttemptId();
const attemptStartedAt = Date.now();
let nextSeq = 1;
const allEvents = [];
const pendingEvents = [];
```

Если тренажёр должен поддерживать очень старый Legacy-браузер, telemetry-код может отсутствовать в Legacy-копии; не добавлять современный синтаксис, который ломает её парсинг.

## 3. Данные ученика

Например:

```js
const student = {
  firstName: "",
  lastName: "",
  className: "",
  studentId: null
};
```

Собирать только необходимые данные.

## 4. Универсальная функция события

Пример современного клиента:

```js
function recordEvent(eventType, eventSource, context, data) {
  const event = {
    seq: nextSeq++,
    eventType,
    eventVersion: TELEMETRY_CONFIG.eventVersion,
    schemaVersion: TELEMETRY_CONFIG.schemaVersion,
    clientTime: new Date().toISOString(),
    elapsedMs: Date.now() - attemptStartedAt,
    trainerId: TELEMETRY_CONFIG.trainerId,
    trainerVersion: TELEMETRY_CONFIG.trainerVersion,
    eventSource,
    context: context || {},
    data: data || {}
  };

  allEvents.push(event);
  pendingEvents.push(event);

  if (pendingEvents.length >= 10) {
    sendTelemetryBatch();
  }

  return event;
}
```

## 5. Начало попытки

После того как тренажёр готов к работе и данные ученика получены:

```js
recordEvent(
  "attempt_started",
  "system",
  { pageId: "page-1" },
  {
    firstName: student.firstName,
    lastName: student.lastName,
    className: student.className,
    studentId: student.studentId,
    subjectId: TELEMETRY_CONFIG.subjectId,
    courseId: TELEMETRY_CONFIG.courseId,
    schoolId: TELEMETRY_CONFIG.schoolId
  }
);
```

## 6. Ответы

При каждом реальном изменении ответа фиксировать полное состояние до/после:

```js
recordEvent(
  "answer_changed",
  "user",
  {
    pageId: "page-2",
    questionId: "q5",
    controlId: "q5-option-b"
  },
  {
    previousAnswer: ["A"],
    answer: ["B"]
  }
);
```

Не хранить только `checked=true/false`, если этого недостаточно для восстановления полного ответа.

## 7. Видимость вопросов

При открытии страницы сформировать `question_available` для вопросов, которые на ней существуют.

Для реального входа/выхода из viewport в современном клиенте можно использовать `IntersectionObserver` и формировать `question_visible` / `question_hidden` при каждом переходе состояния.

## 8. Навигация и submit

Перед переходом `Далее` зафиксировать текущее состояние страницы:

```js
recordEvent(
  "page_submitted",
  "navigation",
  { pageId: "page-2" },
  {
    submissionNo: 1,
    trigger: "next-button"
  }
);

recordEvent(
  "page_left",
  "navigation",
  { pageId: "page-2" },
  { toPage: "page-3" }
);

recordEvent(
  "page_opened",
  "navigation",
  { pageId: "page-3" },
  { fromPage: "page-2" }
);
```

Повторный submit получает следующий `submissionNo`.

## 9. Visibility / focus / network

Подключить по механике тренажёра:

```text
visibility_hidden / visibility_visible
window_blur / window_focus
online / offline
```

События являются фактами. Не интерпретировать их в клиенте как нарушение.

## 10. Idle

Если idle нужен, завести явный порог и фиксировать:

```text
idle_started
idle_ended
```

Idle может пересекаться с hidden. Не суммировать эти времена как взаимоисключающие состояния.

## 11. Clipboard

Можно фиксировать `copy`, `paste`, `cut`, `context_menu`, но не содержимое буфера. Если нужен параметр, ограничиться, например, `textLength`.

## 12. Heartbeat

Heartbeat полезен для состояния видимости/сети/idle между пользовательскими действиями. Интервал выбирать умеренным; тестовая практика проекта использовала порядка 15 секунд.

## 13. Отправка пакета

```js
let telemetrySending = false;

async function sendTelemetryBatch() {
  if (telemetrySending) return;
  if (!navigator.onLine) return;
  if (!pendingEvents.length) return;

  telemetrySending = true;
  const batch = pendingEvents.slice(0, 25);

  try {
    const response = await fetch(TELEMETRY_CONFIG.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        schemaVersion: TELEMETRY_CONFIG.schemaVersion,
        attemptId,
        trainerId: TELEMETRY_CONFIG.trainerId,
        events: batch
      })
    });

    if (!response.ok) {
      throw new Error("HTTP " + response.status + ": " + await response.text());
    }

    const result = await response.json();
    if (!result.ok) {
      throw new Error(result.error || "Telemetry server error");
    }

    pendingEvents.splice(0, batch.length);
  } catch (error) {
    console.error("Telemetry send error:", error);
  } finally {
    telemetrySending = false;
  }
}
```

Ключевое правило: `splice` только после `HTTP 200` и `result.ok === true`.

## 14. Триггеры отправки

```js
setInterval(function () {
  sendTelemetryBatch();
}, 10000);

window.addEventListener("online", function () {
  sendTelemetryBatch();
});

document.addEventListener("visibilitychange", function () {
  if (document.hidden) {
    sendTelemetryBatch();
  }
});
```

Дополнительно отправлять при `pendingEvents.length >= 10` и при завершении попытки.

`pagehide`/`visibilitychange` не гарантируют завершение асинхронного `fetch` во всех браузерах. Текущая схема должна рассматривать финальную отправку как best effort; надёжность при закрытии вкладки повышается после перехода на IndexedDB/отдельную устойчивую стратегию доставки.

## 15. Retry

При ошибке ничего не удалять. Следующий вызов отправит тот же пакет с теми же `seq`.

Идемпотентность обеспечивается серверным ключом `(attempt_id, seq)`.

## 16. Завершение

До показа финального экрана:

```text
зафиксировать ответы текущей страницы
→ page_submitted
→ attempt_finished
→ остановить таймеры
→ заморозить summary
→ sendTelemetryBatch()
→ показать результат
```

Пример:

```js
recordEvent(
  "attempt_finished",
  "system",
  { pageId: "page-final" },
  {
    score: 8,
    maxScore: 10,
    durationMs: Date.now() - attemptStartedAt
  }
);

sendTelemetryBatch();
```

## 17. Локальная выгрузка

Сформировать объект:

```js
const attemptExport = {
  schemaVersion: TELEMETRY_CONFIG.schemaVersion,
  trainerId: TELEMETRY_CONFIG.trainerId,
  trainerVersion: TELEMETRY_CONFIG.trainerVersion,
  attemptId,
  student,
  startedAt: new Date(attemptStartedAt).toISOString(),
  finishedAt: new Date().toISOString(),
  summary: {},
  events: allEvents
};
```

Предоставить пользователю/диагностике возможность скачать JSON, если это соответствует сценарию тренажёра.

## 18. Ошибки UI

Не показывать `Telemetry send error` как «неверный ответ». Допустим незаметный retry, технический статус или диагностическая запись в console. Учебная логика должна быть независима.

## 19. Проверка перед публикацией

### Локально

```text
[ ] каждый reload/new start создаёт новый attemptId
[ ] seq начинается с 1
[ ] события идут без повторного использования seq внутри попытки
[ ] attempt_started есть
[ ] answer_changed соответствует реальным ответам
[ ] page_submitted возникает в нужные моменты
[ ] attempt_finished есть
[ ] локальный JSON содержит полный event log
```

### Сеть

```text
[ ] POST уходит на /api/v1/events
[ ] body содержит schemaVersion, attemptId, trainerId, events
[ ] пакет 10–25 событий
[ ] pendingEvents очищается только после ok=true
[ ] offline не ломает UI
[ ] после online выполняется retry
[ ] повторная отправка тех же seq не создаёт логически новую попытку
```

### Безопасность

```text
[ ] нет service-account key
[ ] нет OAuth/IAM token
[ ] нет прямого YDB credential
[ ] клиент знает только публичный API URL и JSON contract
[ ] в тренажёре нет ключа учителя (TEACHER_TOKEN)
```

### Ключ учителя

С 10.10.2026 чтение событий (`GET`) и удаление попыток (`DELETE`) требуют ключ учителя. Тренажёрам ничего менять не нужно: `POST /api/v1/events` работает без ключа. Ключ нужен только просмотрщикам результатов учителя (`LOCAL_…`-файлы): они отправляют `Authorization: Bearer <ключ>`. Подробно — [TELEMETRY_API_AND_BACKEND.md](TELEMETRY_API_AND_BACKEND.md), разделы 4 и 15.

## 19a. Надёжность отправки и статус для ученика

По опыту 4.0 (тренажёры физики):

- каждый запрос ограничивать тайм-аутом 20 с (`AbortController`), чтобы «зависшее» соединение не блокировало следующие отправки;
- `keepalive: true` использовать только при уходе со страницы и только для тела меньше 60 КБ;
- не прекращать попытки при `navigator.onLine === false`, а показывать статус и повторять позже;
- показывать ученику небольшую отметку: «✓ Ответы переданы учителю», «Ответы отправляются…» или «⚠ Нет связи с сервером учителя… В конце обязательно сохраните ZIP»;
- отметку скрывать при печати.

Для отправки итогового файла учителю используется `result_submitted` — [TRAINER_TELEMETRY_SPEC.md](TRAINER_TELEMETRY_SPEC.md), раздел 30.

## 20. Базовый промпт для следующего тренажёра

```text
Создай автономный HTML-тренажёр по спецификации проекта Learn-it 4.3.

Обязательная телеметрия:
schemaVersion = 1
eventVersion = 1
API = https://d5d3qbcrq94lchv37arh.cmxivbes.apigw.yandexcloud.net/api/v1/events

Задай уникальные trainerId и trainerVersion.
Для каждой новой попытки создай новый attemptId.
seq начинается с 1 и строго возрастает.

Каждое событие содержит:
seq, eventType, eventVersion, schemaVersion, clientTime, elapsedMs,
trainerId, trainerVersion, eventSource, context, data.

Сохраняй полный локальный event log и pendingEvents.
Отправляй события пакетами 10–25:
- каждые 10 секунд;
- при накоплении 10 событий;
- при скрытии страницы, когда возможно;
- после восстановления online;
- при завершении попытки.

Удаляй отправленный пакет только после HTTP 200 и ok=true.
При retry используй те же attemptId и seq.

Минимально поддержи:
attempt_started, attempt_finished,
page_opened, page_left,
question_available, question_visible, question_hidden,
answer_changed, page_submitted,
visibility_hidden, visibility_visible,
window_blur, window_focus,
idle_started, idle_ended,
online, offline,
copy, paste, cut, context_menu,
heartbeat.

Для ответа сохраняй previousAnswer и answer как полное состояние.
Сделай локальную JSON-выгрузку всей попытки.
Не подключайся напрямую к YDB и не помещай секреты Yandex Cloud и ключ учителя в HTML.
Сбой Telemetry API не должен блокировать учебную механику.

Оформление и тексты — по STYLE_GUIDE.md: форма входа «Имя» и «Фамилия» без поля «Класс»,
кнопка «Пройти анонимно»; сообщения проверки краткие и нейтральные;
правильный вариант не самый длинный; ввод кода только с проверкой,
не зависящей от пробелов и регистра.
```
