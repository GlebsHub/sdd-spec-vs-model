# План: раздел «Мои клиенты»

## 1. Файлы и слои

Слои снизу вверх. Защищённые файлы (`src/shared/api/clients/**`, `http.ts`, `errors.ts`, `shared/lib/money/**`, `shared/lib/session/**`, `src/mocks/**`, `src/test/**`, `src/main.tsx`) не меняются. Новые файлы создаются в `src/` и `e2e/`.

| Слой | Файлы | Назначение |
|---|---|---|
| `shared/api` | — | Используются готовые `ClientListResponseSchema`, `ClientSchema`, `clientKeys`, `http.get`, `isHttpError`, `createQueryClient` |
| `entities/clients` | `params.ts` | Zod-схема `validateSearch` (строки URL → нормализованный поиск), `toListParams` (поиск → параметры API), `nextSort` (цикл сортировки). Чистые функции |
| | `api.ts` | `fetchClientsPage(params, cursor, signal)`: `http.get` со схемой `ClientListResponseSchema` |
| | `queries.ts` | `clientQueries.list(params)` — `infiniteQueryOptions`, `staleTime: 60_000`, `getNextPageParam: nextCursor ?? undefined`, `placeholderData: keepPreviousData` в хуке |
| | `useClients.ts` | Хук чтения: возвращает `clients`, `total`, `isPending`, `isError`, `hasNextPage`, `isFetchingNextPage`, `isFetchNextPageError`, `fetchNextPage`, `refetch`, `isPlaceholderData` |
| | `index.ts` | Публичный API |
| `features/client-columns` | `columns.ts` | `CLIENT_COLUMN` (id колонок), подписи, `HIDEABLE_COLUMNS`, значения по умолчанию |
| | `columnsStorage.ts` | Zod-схема `localStorage` и чтение/запись по ключу `agent-cabinet:clients-columns:v1:<agentId>` |
| | `useColumnVisibility.ts` | Состояние видимости (TanStack `columnVisibility`) синхронизированное с `localStorage`, сброс «По умолчанию» |
| | `ColumnSettingsButton.tsx` | Кнопка «Настроить колонки» (`Popover` + `Checkbox`), «ФИО» нельзя снять |
| `features/client-filters` | `useClientsSearchState.ts` | Единственный доступ к URL-состоянию списка: `search`, `updateSearch(patch, opts)`, `resetFilters`, `hasFilters`. Использует `getRouteApi("/clients")` |
| | `ClientFilters.tsx` | Поле поиска (debounce 300 мс локально), `Select` статусов, `DatePicker.RangePicker`, кнопка «Сбросить фильтры» |
| `widgets/clients-table` | `columns.tsx` | Определения колонок TanStack Table, рендер ячеек, тег статуса, `formatMoney`, `dayjs` для даты |
| | `ClientsTable.tsx` | Заголовок со счётчиком, панель фильтров, «Настроить колонки», таблица, виртуализация, все состояния, догрузка |
| | `index.ts` | Экспорт `ClientsTable`, `CLIENTS_SCROLL_ID` |
| `pages/clients` | `ClientsPage.tsx` | Тонкая обёртка: рендерит `ClientsTable` |
| `app` | `router.tsx` (меняется) | `validateSearch` на маршруте `/clients`, `scrollRestoration: true`, `getScrollRestorationKey` с префиксом на загрузку модуля, `scrollToTopSelectors: [data-scroll-restoration-id="…"]` |
| | `styles.css`/CSS Modules | Стили таблицы через CSS Modules в `widgets/clients-table` |

Конвенции: компоненты не вызывают HTTP напрямую, только хуки `entities/clients`. Ключи запросов — только через `clientKeys` из `shared/api`.

## 2. Где хранится состояние

| Состояние | Где | Детали |
|---|---|---|
| Данные списка | TanStack Query | Ключ `clientKeys.list(params)`, где `params` = `{ q, status, dateFrom, dateTo, sort }` без курсора и без номера страницы |
| Поиск, статус, период, сортировка | URL (`/clients?q&status&from&to&sort`) | Значения по умолчанию не пишутся (`sort` без параметра = `registeredAt:desc`). Строки в URL, без JSON-сериализации |
| Ввод в поле поиска до debounce | `useState` в `ClientFilters` | Debounce 300 мс, затем `navigate({ replace: true })` |
| Видимость колонок | `localStorage` по `agentId` | Версия в ключе; невалидные данные и неизвестные колонки → значения по умолчанию; ошибки доступа глушатся |
| Позиция прокрутки | Scroll restoration роутера | `useElementScrollRestoration({ id: CLIENTS_SCROLL_ID })` → `initialOffset` виртуализатора |
| Текущий агент | `useCurrentAgent()` (session) | Только чтение, для ключа `localStorage` |
| Zustand | Не используется | Нет общего состояния несвязанных компонентов |

## 3. Требования → план → тесты

| Требование | Что закрывает | Тест |
|---|---|---|
| AC-01 скелетон, первые 50, сортировка по дате убыв., счётчик | `useClients` (limit 50, `registeredAt:desc` по умолчанию), `ClientsTable` skeleton, счётчик `total` | Integration: «первая порция — скелетон, затем 50 строк и счётчик»; unit: `toListParams` без `sort` |
| AC-02 колонки, порядок, форматы, видимость по умолчанию | `columns.ts`, `columns.tsx` (фиксированный порядок, `Продуктов` скрыта) | Integration: порядок заголовков, «Продуктов» отсутствует по умолчанию |
| AC-03 комиссия 0 и 5 копеек | `formatMoney` в `commissionKopecks` | Integration: строки с `0,00 ₽` и `0,05 ₽` (фикстуры `db.ts`) |
| AC-04 поиск debounce 300 мс, от 2 символов | `ClientFilters` debounce, `toListParams` (q < 2 не передаётся) | Integration: посимвольный ввод «Иванов» → один запрос `q=Иванов` в `getRequestLog`; unit: q из 1 символа не в запросе |
| AC-05 статус и период, кнопка сброса | `ClientFilters`, `useClientsSearchState.hasFilters`, `resetFilters` (сохраняет `sort`) | Integration: фильтр статуса в запросе; «Сбросить» не видна без фильтров; сброс не трогает сортировку |
| AC-06 смена фильтра/сортировки → первая порция, прокрутка к началу | Ключ с параметрами, `scrollToTopSelectors` | Integration: новый запрос без cursor; E2E: прокрутка в начало |
| AC-07 сортировка п. 6, иконка и `aria-sort` | `nextSort`, `columns.tsx` | Unit: цикл `desc→asc→desc`, новая колонка → `desc`; integration: `aria-sort` |
| AC-08 догрузка по концу, стоп при `nextCursor = null` | `useClients`, эффект на `virtualizer.range.endIndex`, условие `hasNextPage && !isFetchingNextPage && !isFetchNextPageError` | E2E: прокрутка догружает; integration: при `nextCursor = null` запросов больше нет |
| AC-09 состояния п. 7 | `ClientsTable` (все состояния), `isFetchNextPageError` сохраняет строки | Integration: пусто без фильтров, пусто с фильтрами, ошибка первой порции + повтор, ошибка догрузки сохраняет строки, 403 |
| AC-10 URL, открытие по ссылке, некорректные значения | `validateSearch` (`params.ts`), `toListParams` | Unit: мусор в `status`, `from`, `sort` → по умолчанию; integration: открытие `?status=LEAD` |
| AC-11 назад: фильтры, сортировка, строки из кэша ≤ 60 с, прокрутка | `staleTime: 60_000`, scroll restoration, `initialOffset` | E2E: переход в карточку и «назад» |
| AC-12 перезагрузка: фильтры и сортировка | URL + уникальный ключ скролла на документ | E2E: reload; прокрутка после reload не восстанавливается |
| AC-13 колонки в `localStorage` по агенту, ФИО нельзя скрыть, «По умолчанию» | `useColumnVisibility`, `columnsStorage.ts` | Unit: чтение/запись/невалидные данные; integration: скрытие переживает перемонтирование, у другого агента — по умолчанию |
| AC-14 клавиатура, подписи полей, статус текстом | `Enter` на строке, `aria-label` у полей, `Tag` с текстом | Integration: `Enter` открывает карточку; `getByRole('combobox', {name: 'Статус'})` и т. п. |
| AC-15 не более 60 строк в DOM при 10 000 строк | `useVirtualizer` с `overscan: 10`, фикс. высота строки | E2E: после прокрутки по всему списку ≤ 60 `tr` в таблице |

## 4. Вопросы к спеке и допущения

1. **Q:** Что хранить в URL для `q` из 1 символа или с пробелами по краям? **Допущение:** в URL пишется `trim()`-версия; в API `q` уходит только при длине ≥ 2 (п. 5).
2. **Q:** Что делать, если `from` > `to`? **Допущение:** не валидируем, бэкенд вернёт `total = 0`, показываем «Ничего не найдено».
3. **Q:** Как показывать 403 при догрузке? Спека описывает 403 только для первой порции. **Допущение:** 403 при догрузке — обычная ошибка догрузки с «Повторить».
4. **Q:** Некорректные значения в `status` (часть корректна)? **Допущение:** оставляем корректные значения, некорректные отбрасываем; если не осталось ни одного — параметр не применяется.
5. **Q:** Формат счётчика в заголовке. **Допущение:** число с разделителем разрядов (неразрывный пробел), как в денежных суммах; отдельным элементом, чтобы accessible name заголовка был ровно «Мои клиенты».
6. **Q:** Скелетон на «10 строк». **Допущение:** 10 строк скелетона внутри таблицы, без отдельного блока.
7. **Q:** Что значит «Не удалось загрузить клиентов» при догрузке, если сработал повтор? **Допущение:** «Повторить» вызывает только `fetchNextPage`.
8. **Конфликт (конвенции п. 3 vs. структура `shared/api`):** Zod-схема параметров списка по конвенции лежит в `schema.ts` сущности, но `shared/api/clients/**` защищён. **Решение:** схема URL и маппинг параметров в `entities/clients/params.ts`; схема ответа — готовая из `shared/api`. Расхождение записано здесь.
9. **Дата в таблице:** `dayjs` в локальном часовом поясе браузера (`timezoneId: Europe/Moscow` в Playwright). Фильтр по дате на бэкенде — календарные даты из URL без пересчёта (п. 5 спеки).

## 5. Порядок работы

1. `entities/clients` (params, api, queries, useClients) + unit-тесты `params.ts`.
2. `features/client-columns` + unit-тесты хранилища.
3. `features/client-filters` (URL-хук, фильтры).
4. `widgets/clients-table` (колонки, таблица, состояния, виртуализация) + интеграционные тесты.
5. `pages/clients`, `router.tsx` (validateSearch, scroll restoration).
6. E2E (`e2e/clients.spec.ts`).
7. `npm run check` (typecheck, lint, test), затем e2e.
