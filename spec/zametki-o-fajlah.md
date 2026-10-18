## Himiya_9_klass_zanyatie_6.html — пример конспекта с сайта LearnItUp
- Путь: /mnt/project-files/uploads/hearth/8c53592a-19ed-489c-8ece-b0391254cf53 (HTML, 46 КБ, одна страница, всё встроено).
- Формат сайта: meta `material:specification` = "HTML Material Specification v1.5", `material:version`, `catalog:title/type/topic/description/tags/order/hidden`; ссылка «Каталог курса» → index.html.
- Структура: шапка, липкое меню разделов, «Маршрут занятия» с таймингом, диагностика, теория карточками, тренажёр по экранам, итог + ДЗ; есть стили для печати (.interactive-only скрывается).
- Отправка: в конце ученик вводит фамилию/имя, страница скачивает zip с results.json (ответы + журнал событий) и POST'ит его (base64, text/plain) в Apps Script → Google Диск учителя; поля course, task, lastName, firstName, fileName, mimeType, data; ответ {ok:true}.
- Журнал событий: page_load, answer_change, input_focus/blur, visibility, screen_view, finish; хранится в localStorage.

## learn-it-kratkoe-opisanie.md — правила сайта Learn-it 4.3 (от Антона, 18.10.2026)
- Путь: /mnt/project-files/uploads/hearth/f4deabd1-d5b0-4ed6-9293-115bc9ecd83c (Markdown, ~10 КБ). Полные правила: репозиторий antlogin/my-cources-catalog, Docs/learn-it-4.3/.
- Главное для конспектов: один автономный HTML-файл, БЕЗ CDN и внешних библиотек; sync копирует только .html/.pdf/картинки (отдельный .js не опубликуется).
- Метатеги catalog:title (без «Занятие N»), catalog:type=lesson; ссылку в каталог и Метрику вставляет сборка.
- Части занятия — переключаемые страницы, первый пункт меню «План занятия»; без футера; безличный академический язык (без «ты/мы»), цели инфинитивом, «Проверить себя» в конце темы; школа в Черногории, примеры не про Россию.
- Телеметрия уже есть: POST /api/v1/events (Yandex Cloud Function → YDB), TELEMETRY_CONFIG, attemptId, seq, пакеты раз в 10 с, удаление из очереди после 200 ok:true; вход «Имя/Фамилия» + «Пройти анонимно»; секретов в HTML не класть.

## learn-it-docs-4.3-2026-10-14.zip — полная документация Learn-it 4.3
- Путь: /mnt/project-files/uploads/hearth/4c9f22bc-9e91-4dc3-a16d-f8b94a87c76c (zip, 18 md-файлов + design_project_template.html, ~270 КБ в распаковке).
- Главные: 02-materials/HTML_MATERIAL_SPEC.md, STYLE_GUIDE.md, MATERIAL_CREATION_GUIDE.md; 05-telemetry/TRAINER_TELEMETRY_SPEC.md.
- Выжимка для курса «Алгоритмы + Python, 8 кл.» и наши отступления: /mnt/project-files/bosova-8/specifikaciya-konspekta.md.
