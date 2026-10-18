# Краткая инструкция создания учебного материала

**Версия пакета:** Learn-it 4.3  
**Назначение:** компактный рабочий контекст для генерации отдельного конспекта, теста или тренажёра.

При конфликте с кратким гайдом приоритет имеет [HTML_MATERIAL_SPEC.md](HTML_MATERIAL_SPEC.md) и специализированные документы каталога/телеметрии. Язык, заголовки, вёрстка текста, формулы и задания — по [STYLE_GUIDE.md](STYLE_GUIDE.md).

## 1. Базовый HTML

В `<head>` обязательно:

```html
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
```

Не использовать:

```html
user-scalable=no
maximum-scale=1
```

Страница должна корректно работать на desktop, mobile, при browser zoom и системном масштабировании.

## 2. Метаданные каталога

Обязательные:

```html
<meta name="catalog:title" content="Название материала">
<meta name="catalog:type" content="lesson">
```

Тип открыт, например:

```text
lesson
test
trainer
game
reference
lab
exam
cheatsheet
presentation
```

Необязательные:

```html
<meta name="catalog:topic" content="">
<meta name="catalog:description" content="">
<meta name="catalog:tags" content="">
<meta name="catalog:order" content="">
<meta name="catalog:hidden" content="">
<meta name="catalog:legacy" content="">
<meta name="catalog:number" content="">
<meta name="catalog:parent" content="">
<meta name="catalog:nav" content="">
```

### Конспект и материалы к нему

- Одна папка занятия — один конспект (`catalog:type=lesson`) и материалы к нему: тренажёры, анимации, заметки, PDF.
- Материал из папки конспекта сам попадает в строку этого конспекта в каталоге, отдельного номера не получает.
- Материал вне папки конспекта привязывается через `catalog:parent` (путь к файлу конспекта); без него он попадёт в «Общие материалы».
- Номер конспекта присваивается автоматически при первой публикации. `catalog:number` задаётся только при необходимости.
- Ссылку «в каталог» вручную не добавлять: её вставляет сборка. Для полноэкранной анимации или игры можно отключить: `catalog:nav=off`.

Подробно — [NAVIGATION_SPEC.md](../03-catalog/NAVIGATION_SPEC.md).

### Скрытый опубликованный файл

```html
<meta name="catalog:hidden" content="true">
```

Он копируется и открывается по прямой ссылке, но не получает отдельную строку каталога.

### Legacy

Для нового материала рекомендуется:

```text
material.html
material_Legacy.html
```

В основном файле:

```html
<meta name="catalog:legacy" content="material_Legacy.html">
```

В Legacy-файле:

```html
<meta name="catalog:hidden" content="true">
```

Путь должен быть относительным и не выходить выше корня курса. Генератор проверит существование файла.

## 3. Геометрия

### Desktop > 1400 CSS px

```css
:root { --material-max: 1120px; }

.wrap,
main {
  width: min(var(--material-max), calc(100% - 40px));
  margin-inline: auto;
}
```

Широкий экран увеличивает поля, а не интерфейс.

### Compact desktop: 721–1400 CSS px

```css
@media (max-width: 1400px) and (min-width: 721px) {
  .wrap,
  main {
    width: min(900px, calc(100% - 36px));
    margin-inline: auto;
  }
}
```

Ориентиры: body около 14 px, h1 около 24 px, h2 около 18 px, карточки около 14 px padding, кнопки около 34 px высотой.

### Mobile ≤ 720 CSS px

- одна колонка;
- поля около 14 px;
- основной текст 16 px или больше;
- h1 около 24 px;
- h2 около 20 px;
- touch target не меньше примерно 44 px;
- без горизонтальной прокрутки страницы.

### Текст

- основной текст на компьютере в две колонки, на телефоне в одну; одиночный абзац между блоками — в узкой колонке около 680 px;
- крупные блоки текста по ширине, красная строка 1,5 em, `hyphens: auto`; на телефоне по левому краю;
- таблицы не шире примерно 920 px, графики не шире примерно 560 px;
- футера нет.

Подробно: [STYLE_GUIDE.md](STYLE_GUIDE.md).

## 4. Визуальная система

```css
:root {
  --green: #123d32;
  --green2: #1d5a49;
  --paper: #ffffff;
  --bg: #edf2ee;
  --ink: #14201c;
  --muted: #61716b;
  --accent: #ffb000;
  --ok: #238b57;
  --bad: #c8413a;
  --line: #d7e0dc;
}
```

Header — служебный блок, не hero-screen. Карточки компактные, без декоративной избыточности.

## 5. Доступность

Keyboard focus должен быть заметен:

```css
button:focus-visible,
a:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}
```

Для одиночного выбора использовать нативный `radio`, для множественного — `checkbox`. Native input можно визуально скрыть, но нельзя удалять из accessibility tree через `display:none`.

Правильный/ошибочный результат должен различаться не только текстом.

Учитывать:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
    animation: none !important;
    scroll-behavior: auto !important;
  }
}
```

## 6. Конспект

Для обычного материала нужны корректные `catalog:*`, адаптивность, читаемость и, при необходимости, `@media print`. Ненужную интерактивность не добавлять.

Язык: академический, но простой; пояснения безличны («Определяется…», а не «Определим…»), без «ты», призывов и риторических вопросов; заголовки назывные. В конце новой темы — задания с плашкой «Проверить себя».

### Ссылки

- Кнопка «Каталог курса» ведёт на абсолютный адрес `https://<сайт>.learn-it.app/`, например `https://alg-11-class.learn-it.app/`.
- Адреса `*.netlify.app` не использовать: публикация на Netlify прекращена.
- Ссылка на материал другого урока — относительная, через папку того урока: `../Урок_14_0210/trig_unit_circle_trainer.html`, а не просто имя файла.
- Перед публикацией проверить, что все ссылки открываются (нет 404).

### Служебные материалы учителя

Ключи ответов, варианты контрольных, просмотрщики результатов кладутся в папку, имя которой начинается с `_Local` или `Local` (например, `_Local-Data`), или называются `LOCAL_…` — с подчёркиванием. Такие файлы и папки не синхронизируются, не коммитятся и не публикуются. Файл `LOCAL-…` с дефисом этим правилом не покрывается и публикуется.

## 7. Тренажёр

Помимо общих требований:

- выбор, проверка, успех и ошибка должны быть различимы;
- сообщения проверки краткие и нейтральные: «Верно», «Неверно», «Неверно определены: …»;
- правильный вариант не выделяется длиной, неверные варианты правдоподобны;
- ввод кода или команды допустим только при проверке, не зависящей от пробелов и регистра (или по поведению программы);
- техническая ошибка телеметрии не должна выглядеть как учебная ошибка;
- учебный сценарий продолжает работать при недоступном API;
- файлы, создаваемые учеником, по умолчанию сохраняются локально;
- Netlify Forms не используются; если учитель должен получить файл, копия отправляется через `cloudSubmit` (`result_submitted`), а при ошибке ученик сохраняет файл и передаёт его сам.

## 8. Конфигурация телеметрии

Для нового тренажёра использовать:

```js
const TELEMETRY_CONFIG = {
  schemaVersion: 1,
  eventVersion: 1,
  trainerId: "UNIQUE-TRAINER-ID",
  trainerVersion: "1.0.0",
  subjectId: "subject-id",
  courseId: "course-id",
  schoolId: null,
  apiUrl: "https://d5d3qbcrq94lchv37arh.cmxivbes.apigw.yandexcloud.net/api/v1/events"
};
```

`trainerId` идентифицирует конкретное учебное назначение, а не общий шаблон.

На каждую новую попытку создать новый `attemptId`.

## 9. Формат события

Обязательные поля:

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

`seq` начинается с 1 и строго возрастает.

Источники события:

```text
user
browser
timer
navigation
system
```

## 10. Базовые события

Рекомендуемый базовый набор текущей спецификации:

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

Не сохранять содержимое clipboard. Не собирать движения мыши, pixel-scroll и каждый keypress без отдельной педагогической причины.

## 11. Очередь и отправка

Событие сначала попадает в `pendingEvents`.

Рекомендуемые триггеры отправки:

```text
каждые 10 секунд
при очереди >= 10 событий
при уходе страницы в background
после восстановления online
при завершении попытки
```

Пакет браузера: обычно 10–25 событий. Серверный максимум текущей версии — 200 событий за POST.

Удалять пакет из очереди только после:

```text
HTTP 200
и
ok === true
```

При ошибке повторно использовать те же `attemptId` и `seq`.

## 12. Локальный JSON

Тренажёр должен уметь сохранить полный локальный JSON попытки: данные ученика, `attemptId`, времена, summary и все события.

## 13. Секреты

В HTML/JS не помещать ключ сервисного аккаунта, OAuth/IAM token, YDB credentials, access/secret key и ключ учителя (`TEACHER_TOKEN`). Публичный API URL хранить можно.

## 14. Чек-лист

### Для любого материала

```text
[ ] catalog:title
[ ] catalog:type
[ ] desktop max ≈ 1120 px
[ ] compact desktop предусмотрен
[ ] mobile — одна колонка, нет горизонтальной прокрутки
[ ] основной текст на desktop в две колонки, по ширине, красная строка
[ ] текст по STYLE_GUIDE.md: безлично, термины, назывные заголовки
[ ] неразрывные пробелы перед единицами, формулы не разрываются
[ ] «Каталог курса» ведёт на https://<сайт>.learn-it.app/, ссылки между уроками открываются
[ ] служебное учителя — в _Local…/Local… или LOCAL_…
[ ] mobile text ≥ 16 px
[ ] touch target ≈ 44 px или больше
[ ] browser zoom не запрещён
[ ] keyboard focus видим
[ ] prefers-reduced-motion учтён
```

### Дополнительно для тренажёра

```text
[ ] уникальный trainerId
[ ] trainerVersion задан
[ ] новый attemptId на попытку
[ ] seq начинается с 1 и возрастает
[ ] attempt_started создаётся
[ ] answer_changed создаётся по механике задания
[ ] page_submitted создаётся при фиксации страницы
[ ] attempt_finished создаётся
[ ] локальный JSON доступен
[ ] pendingEvents не очищается при ошибке
[ ] API failure не ломает задание
[ ] в клиенте нет облачных секретов
```

### Если есть Legacy

```text
[ ] основной файл содержит catalog:legacy
[ ] путь относительный и безопасный
[ ] Legacy-файл существует
[ ] Legacy содержит catalog:hidden=true
[ ] Legacy не получает отдельную строку каталога
```
