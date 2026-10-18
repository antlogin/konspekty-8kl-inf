# Инфраструктура: Yandex Cloud, домен, сертификат

**Версия пакета:** Learn-it 4.3  
**Состояние на:** 2026-10-10

Документ описывает, где что настроено и как это обслуживать. Телеметрия (API Gateway, функция, YDB) — в [TELEMETRY_API_AND_BACKEND.md](../05-telemetry/TELEMETRY_API_AND_BACKEND.md).

## 1. Облако

```text
Облако:    cloud-antlogin-off   (b1gau3gh9inb8pgfj05m)
Каталог:   trainer-telemetry    (b1gof7bq8juoj91v6ngh)
```

В одном каталоге находятся бакеты сайтов, сертификат и телеметрия.

## 2. Бакеты Object Storage

| Бакет | Содержимое | Кто обновляет |
|---|---|---|
| `learn-it.app` | главная (`home/`) | GitHub Actions |
| `www.learn-it.app` | пустой, перенаправляет всё на `https://learn-it.app` | настроен один раз вручную |
| `<сайт>.learn-it.app` | папка класса из `sites.json` | GitHub Actions, создаёт при первой публикации |

Настройки бакета сайта (выставляет `scripts/deploy-yandex.sh`):

- публичное чтение объектов флагом `--public-read`, листинг закрыт (`--public-list=false`, `--public-config-read=false`), ACL бакета `private`; без `yc` (нет `YC_CERT_ID` или `YC_SA_KEY_JSON`) — ACL `public-read`, и листинг открыт;
- режим веб-сайта, главная страница `index.html`;
- файлы `LOCAL_*` и папки `local*`/`_local*` в бакет не попадают и удаляются из него при деплое;
- HTTPS: сертификат из Certificate Manager (раздел 4).

Имя бакета должно совпадать с адресом сайта: Object Storage выбирает бакет по адресу, который открыл браузер.

Проверка: `https://<сайт>.learn-it.app/` → 200, `https://storage.yandexcloud.net/<бакет>/?list-type=2` → 403. На 10.10.2026 проверены все 15 бакетов.

## 3. DNS (Porkbun)

Домен `learn-it.app` зарегистрирован и обслуживается в Porkbun: porkbun.com → Account → Domain Management → learn-it.app → DNS.

| Тип | Host | Значение | Зачем |
|---|---|---|---|
| ALIAS | `learn-it.app` | `learn-it.app.website.yandexcloud.net` | главная |
| CNAME | `www` | `learn-it.app` | www → бакет-перенаправление |
| CNAME | `*` | `website.yandexcloud.net` | все сайты классов, в том числе будущие |
| CNAME | `_acme-challenge` | `fpqgqvhqgfmqtrv4jn53.cm.yandexcloud.net` | выпуск и продление сертификата |

Правила:

- для нового класса DNS менять не нужно, его покрывает `*`;
- конкретная запись всегда важнее `*`: если появится поддомен вне Yandex (например, почта или другой сервис), достаточно добавить для него свою запись;
- запись `_acme-challenge` не удалять: без неё сертификат не продлится.

## 4. Сертификат (Certificate Manager)

```text
Имя:      learn-it-all
ID:       fpqgqvhqgfmqtrv4jn53
Домены:   learn-it.app, *.learn-it.app
Тип:      Let's Encrypt, проверка через DNS (CNAME)
Выпущен:  2026-10-04, действует до 2027-01-02
```

Let's Encrypt выдаёт сертификат на 90 дней. Certificate Manager продлевает его сам, проверяя запись `_acme-challenge`; бакеты продолжают использовать тот же ID, перепривязывать ничего не нужно.

Предыдущий сертификат `learn-it-wildcard` (`fpqdddppo6ddkft1bs9h`, только `*.learn-it.app`) больше не используется и не продлевается; его можно удалить.

Новая привязка сертификата к бакету начинает работать с задержкой до получаса. В это время браузер может показывать ошибку «Подключение не защищено».

## 5. Сервисный аккаунт и ключи

```text
Сервисный аккаунт:  claude-admin (aje11a0nkjhr1evme4vd), admin на каталоге trainer-telemetry
```

| Где | Имя | Что это |
|---|---|---|
| GitHub → Settings → Secrets → Actions | `YC_ACCESS_KEY_ID`, `YC_SECRET_ACCESS_KEY` | статический ключ: загрузка файлов в бакеты |
| GitHub → Settings → Secrets → Actions | `YC_SA_KEY_JSON` | авторизованный ключ (`authorized_key.json` целиком, как есть): привязка сертификата, закрытие листинга бакетов, деплой функции телеметрии и API Gateway |
| GitHub → Settings → Variables → Actions | `YC_CERT_ID` | `fpqgqvhqgfmqtrv4jn53` |
| GitHub → Settings → Variables → Actions | `SITE_DOMAIN` (необязательно) | по умолчанию `learn-it.app` |

Правила:

- ключи не коммитить и не вставлять в HTML;
- ключ, попавший на скриншот или в переписку, сразу удалить в консоли Yandex Cloud и выпустить новый;
- без `YC_ACCESS_KEY_ID`/`YC_SECRET_ACCESS_KEY` публикация пропускается с предупреждением;
- без `YC_CERT_ID`/`YC_SA_KEY_JSON` сайты публикуются, но новым бакетам сертификат придётся привязать вручную, а листинг бакетов останется открытым;
- без `YC_SA_KEY_JSON` не работает деплой функции телеметрии (`deploy-telemetry.yml`).

Ключ учителя для телеметрии (`TEACHER_TOKEN`) хранится не в GitHub, а в переменных окружения функции `trainer-telemetry-ingest`; см. [TELEMETRY_API_AND_BACKEND.md](../05-telemetry/TELEMETRY_API_AND_BACKEND.md), раздел 4.

## 6. Ручные операции (yc CLI)

```bash
yc config set folder-id b1gof7bq8juoj91v6ngh

# состояние сертификата
yc certificate-manager certificate get fpqgqvhqgfmqtrv4jn53

# привязать сертификат к бакету
yc storage bucket set-https --name phys-9-class.learn-it.app --certificate-id fpqgqvhqgfmqtrv4jn53

# список бакетов
yc storage bucket list

# закрыть листинг бакета, оставив публичное чтение
yc storage bucket update --name phys-9-class.learn-it.app --public-read --public-list=false --public-config-read=false
```

Функция телеметрии и API Gateway вручную не обновляются: их публикует `.github/workflows/deploy-telemetry.yml` со смоук-проверкой и автоматическим откатом функции и шлюза (см. [TELEMETRY_API_AND_BACKEND.md](../05-telemetry/TELEMETRY_API_AND_BACKEND.md), раздел 10).

## 7. Типичные проблемы

| Симптом | Причина и действие |
|---|---|
| «Подключение не защищено» на новом сайте | сертификат привязан недавно — подождать до 30 минут; если не прошло — проверить `yc storage bucket get-https --name <бакет>` |
| `NoSuchBucket` или 404 на `<сайт>.learn-it.app` | сайт ещё не публиковался или опечатка в адресе; проверить запись в `sites.json` и запуск в Actions |
| Изменения не видны | Actions ещё не завершился или кэш браузера — `Ctrl+F5` |
| Деплой долго висит в очереди Actions | сбой GitHub — см. [PUBLISHING_WORKFLOW.md](../04-publishing/PUBLISHING_WORKFLOW.md), раздел 8 |
| В логе деплоя «листинг бакета остаётся открытым» | `yc` недоступен: проверить секрет `YC_SA_KEY_JSON` и переменную `YC_CERT_ID`, затем ручной Run workflow |
| Просмотрщик результатов получает 403 | не введён или неверен ключ учителя |
| Сертификат в статусе `RENEWAL_FAILED` или `INVALID` | проверить запись `_acme-challenge` в Porkbun |
| Ответы учеников не приходят | это не хостинг, а Telemetry API — см. 05-telemetry |
