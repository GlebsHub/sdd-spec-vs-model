# План: раздел «Мои клиенты»

В `SPEC.md` нет нумерованных критериев приёмки, поэтому требования перечислены своими словами (R1–R12) и сопоставлены с частями плана.

## Требования (из SPEC.md)

| # | Требование |
|---|---|
| R1 | Таблица клиентов агента: ФИО, телефон, статус, дата регистрации, комиссия агента |
| R2 | Поиск по ФИО |
| R3 | Фильтр по статусу |
| R4 | Фильтр по дате регистрации |
| R5 | Сортировка |
| R6 | Список подгружается при прокрутке (много клиентов) |
| R7 | Клик по клиенту открывает его карточку |
| R8 | Агент настраивает, какие колонки видит |
| R9 | Данные берутся из `GET /api/agent/clients`, схема ответа — из `shared/api` |
| R10 | (conventions) Состояния таблицы: загрузка, пусто, ошибка с повтором, догрузка, конец списка |
| R11 | (conventions) При возврате из карточки восстанавливаются фильтры, сортировка, загруженные строки, прокрутка |
| R12 | (conventions) Ссылка с параметрами открывает то же состояние |

## Файлы и слои

Порядок реализации снизу вверх: схема → API → запросы → хуки → состояние → UI.

### `entities/client`
| Файл | Назначение |
|---|---|
| `schema.ts` | Реэкспорт контракта из `shared/api` (`ClientSchema`, `CLIENT_STATUS`, …) + `ClientListParamsSchema` (параметры запроса: `q`, `status[]`, `dateFrom`, `dateTo`, `sort{field,direction}`) |
| `types.ts` | `ClientListParams` через `z.infer`, реэкспорт `Client`, `ClientStatus` и др. |
| `api.ts` | `fetchClientsPage(params, { cursor, signal })` → `http.get("/agent/clients", { schema: ClientListResponseSchema })`; массив статусов склеивается через запятую, `limit = 50` |
| `queries.ts` | `clientKeys` (реэкспорт из `shared/api`) и `clientQueries.list(params)` — `infiniteQueryOptions`; ключ = `clientKeys.list(params)`, без курсора; `staleTime` 60 с |
| `useClients.ts` | Хук чтения: `{ clients, total, isPending, isError, isFetching, isFetchingNextPage, isPlaceholderData, hasNextPage, fetchNextPage, refetch }`; `placeholderData: keepPreviousData` |
| `statusMeta.ts` | Подписи статусов и соответствие статус → токен темы |
| `ClientStatusTag.tsx` | Тег статуса, цвет из `theme.useToken()` |
| `index.ts` | Публичный API |

### `features/client-filters`
| Файл | Назначение |
|---|---|
| `schema.ts` | `ClientsSearchSchema` (Zod) — параметры URL со значениями по умолчанию; мусор → значение по умолчанию |
| `types.ts` | `ClientsSearch` (результат схемы) и `ClientsSearchInput` (все поля необязательны — чтобы ссылки на `/clients` не требовали `search`) |
| `params.ts` | `toClientListParams(search)` — URL → параметры запроса (в том числе правило «`q` короче 2 символов не отправляется») |
| `useClientsFilters.ts` | Чтение `search` из роута и функции записи: `setQuery` (replace), `setStatuses`, `setDateRange`, `setSort`, `reset`; `params` для запроса |
| `ClientFiltersPanel.tsx` (+ `.module.css`) | Панель: Input (debounce 300 мс), Select статусов, RangePicker дат, кнопка «Сбросить» |
| `index.ts` | Публичный API |

### `features/column-settings`
| Файл | Назначение |
|---|---|
| `schema.ts` | `ColumnSettingsSchema` для `localStorage` |
| `types.ts` | `ColumnSettings` (через `z.infer`), `ColumnSettingsItem` |
| `storage.ts` | Чтение/запись: ключ с версией и id агента, валидация Zod, отказ хранилища не ломает таблицу |
| `useColumnSettings.ts` | Состояние `columnVisibility` / `columnOrder` для TanStack Table, синхронизация с `localStorage` |
| `ColumnSettings.tsx` | Кнопка «Колонки» + Popover: чекбоксы видимости, кнопки «выше/ниже», «По умолчанию» |
| `index.ts` | Публичный API |

### `widgets/clients-table`
| Файл | Назначение |
|---|---|
| `columns.tsx` | Определения колонок TanStack Table; id = `fullName`, `phoneMasked`, `status`, `registeredAt`, `commissionKopecks` (совпадают с полями сортировки API) |
| `ClientsTable.tsx` (+ `.module.css`) | Панель фильтров + настройка колонок + виртуализированная таблица на `useReactTable` (`manualSorting`, `manualFiltering`), `useInfiniteQuery` через `useClients`, все состояния, scroll restoration |
| `scrollId.ts` | Константа `CLIENTS_TABLE_SCROLL_ID` для роутера (отдельный файл, чтобы не нарушать `react-refresh/only-export-components`) |
| `index.ts` | Публичный API |

### `pages` и `app`
| Файл | Изменение |
|---|---|
| `pages/clients/ClientsPage.tsx` | Заголовок + `ClientsTable` |
| `pages/clients/route.ts` | `validateClientsSearch`, `prefetchClients(queryClient, search)` для `loader` |
| `app/router.tsx` | У `/clients`: `validateSearch`, middleware `stripSearchParams` (значения по умолчанию не пишутся в URL), `loaderDeps`, `loader` с предзагрузкой (без `await`, чтобы смена фильтра не блокировала страницу); в `createRouter`: `scrollRestoration: true`, `scrollToTopSelectors`, `getScrollRestorationKey` с префиксом документа |

### Тесты
| Файл | Уровень |
|---|---|
| `features/client-filters/schema.test.ts` | Unit: схема URL, `toClientListParams` |
| `features/column-settings/storage.test.ts` | Unit: чтение настроек из `localStorage` |
| `widgets/clients-table/ClientsTable.test.tsx` | Интеграционный: состояния, параметры запросов, колонки |
| `e2e/clients.spec.ts` | E2E: прокрутка, карточка и «назад», ссылка с параметрами |

## Где хранится состояние

| Состояние | Где |
|---|---|
| Клиенты, `total`, курсоры | Кэш TanStack Query (`clientKeys.list(params)`) |
| Поиск `q`, статусы `status`, даты `dateFrom`/`dateTo`, сортировка `sort`/`dir` | Параметры URL (`/clients?q=…&status=…`) |
| Видимость и порядок колонок | `localStorage`, ключ `agent-cabinet:clients-table:columns:v1:<agentId>` |
| Позиция прокрутки | Scroll restoration роутера (контейнер `data-scroll-restoration-id="clients-list"`) |
| Текст в поле поиска до debounce, открыт ли попап колонок | `useState` в компоненте |
| Zustand | Не используется: ни одно состояние не подходит под «последний вариант» |

Query-ключ: `["clients", "list", { q, status, dateFrom, dateTo, sort }]`.
Параметры URL: `q`, `status` (массив), `dateFrom`, `dateTo` (`YYYY-MM-DD`), `sort` (поле), `dir` (`asc`/`desc`). По умолчанию: сортировка `registeredAt` / `desc`, остальные пусты.

## Покрытие требований

| Требование | Часть плана | Тест |
|---|---|---|
| R1 | `columns.tsx`, `ClientsTable.tsx`, `ClientStatusTag.tsx`, `formatMoney` | интеграционный: строки и ячейки |
| R2 | `ClientFiltersPanel` (поле + debounce), `q` в URL, `toClientListParams` | unit: схема `q`; интеграционный: запрос с `q`, подсказка при 1 символе |
| R3 | Select статусов, `status` в URL | unit: схема; интеграционный: запрос со `status` |
| R4 | RangePicker, `dateFrom`/`dateTo` в URL | unit: схема, инверсия диапазона; интеграционный: запрос из URL, сброс |
| R5 | Кликабельные заголовки, `sort`/`dir` в URL, `aria-sort` | интеграционный: клик → `sort=…:…` в запросе и `aria-sort` |
| R6 | `useClients` (`useInfiniteQuery`, курсор) + `useVirtualizer` | e2e: прокрутка догружает страницы |
| R7 | Клик/Enter по строке → `/clients/$clientId` | интеграционный: переход; e2e |
| R8 | `features/column-settings` + `localStorage` | unit: storage; интеграционный: скрытие, порядок, переживает перемонтирование |
| R9 | `entities/client/api.ts` (`Schema.parse` через `http.get`) | интеграционный на MSW |
| R10 | Блоки состояний в `ClientsTable.tsx` | интеграционный: загрузка, пусто, пусто с фильтрами, ошибка + повтор, конец списка |
| R11 | URL как источник фильтров, кэш Query, scroll restoration | e2e |
| R12 | `validateSearch` + `loader` | интеграционный: открытие по URL; e2e |

## Вопросы к спеке

Допущения, принятые без ответа:

1. **Тексты и цвета статусов.** `shared/api/clients/schema.ts` и тема ссылаются на «спецификацию, п. 4.2», но в `SPEC.md` такого пункта нет. Допущение: цвета берутся из готовых токенов темы — `LEAD` → `colorStatusNeutral`, `ACCOUNT_OPENED` → `colorStatusInfo`, `FUNDED` → `colorStatusSuccess`, `INACTIVE` → `colorStatusMuted`. Подписи: «Лид», «Счёт открыт», «Пополнил», «Неактивен».
2. **Фильтр по статусу — один или несколько.** Допущение: несколько (сервер принимает список через запятую), пустой выбор = все.
3. **Минимальная длина поиска.** Сервер отвечает 400 на `q` короче 2 символов после trim. Допущение: в URL и в запрос попадают только значения от 2 символов или пустое (очистка); при 1 символе под полем показывается подсказка, запрос не уходит. В URL `q` хранится после trim.
4. **Фильтр по дате.** Допущение: диапазон «с … по …» включительно, любой из концов можно не задавать; даты в формате `YYYY-MM-DD`. Если `dateFrom` позже `dateTo`, оба параметра считаются некорректными и сбрасываются.
5. **Некорректный элемент списка статусов в URL** (`status=LEAD,FOO`). Допущение: по правилу conventions «некорректный параметр → значение по умолчанию» сбрасывается весь параметр, а не отдельный элемент.
6. **Сортировка.** Сортировать можно по ФИО, дате регистрации и комиссии (поля, которые поддерживает сервер); телефон и статус не сортируются. Первый клик по ФИО — по возрастанию, по дате и комиссии — по убыванию; повторный клик меняет направление. Возврат к сортировке по умолчанию — «Сбросить». Сортировка по умолчанию — по дате регистрации, новые сверху (как у сервера).
7. **Ширина колонок.** `conventions.md` (5.4) называет ширину частью настроек колонок, но спека просит только «какие колонки видит». Допущение: реализуем видимость и порядок; изменение ширины мышью не делаем (не требуется спекой). Колонки имеют фиксированные пропорции.
8. **Нельзя скрыть все колонки.** Допущение: последнюю видимую колонку скрыть нельзя (чекбокс блокируется).
9. **Чьи настройки колонок.** «Настройка конкретного пользователя»: ключ `localStorage` содержит id текущего агента из `useCurrentAgent()`.
10. **Клик по клиенту.** Допущение: кликабельна вся строка (мышь и Enter с клавиатуры), строка получает `tabIndex=0`. Карточка — существующая заглушка `/clients/$clientId`.
11. **Колонка «Количество продуктов».** В ответе есть `productsCount`, но в спеке в таблице её нет. Допущение: не показываем.
12. **Дата в таблице.** Формат `ДД.ММ.ГГГГ` в часовом поясе браузера. Мок гарантирует, что дата совпадает в UTC и МСК.
13. **Позиция прокрутки после перезагрузки страницы.** Допущение: не восстанавливается (ключ записи scroll restoration уникален для документа), чтобы не получить пустую область при `initialOffset` до загрузки данных. При «назад» восстанавливается.
14. **Отличие от conventions.** Загрузчик маршрута (`loader`) только запускает предзагрузку и не ждёт её: иначе каждое изменение фильтра блокировало бы страницу в pending-состоянии, а таблица сама показывает все состояния загрузки.
15. **Фильтр агента.** Мок-бэкенд не различает агентов, id агента в запрос не передаётся: контракт `GET /api/agent/clients` его не содержит.
