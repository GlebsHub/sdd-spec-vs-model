# План: раздел «Мои клиенты»

Спецификация — `SPEC.md` v1.3. Правила — `conventions.md`. Готовое в базе используется как есть: контракт `shared/api/clients`, `http.get`, `formatMoney`, `useCurrentAgent`, токены статусов, мок-бэкенд.

## 1. Файлы по слоям

| Слой | Файл | Что |
|---|---|---|
| `entities/client` | `schema.ts` | `ClientsSearchSchema` — параметры URL (`q`, `status`, `from`, `to`, `sort`) с `.catch` по каждому полю; `ClientListParams` — параметры запроса |
| | `types.ts` | `ClientsSearch`, `ClientListParams`, `ClientSort` через `z.infer` |
| | `params.ts` | `toListParams(search)` (URL → API: trim и длина `q`, `from` → `dateFrom`, `to` → `dateTo`, разбор `status` и `sort`), `parseSort` / `formatSort`, `nextSort` (цикл п. 6), `hasFilters` |
| | `api.ts` | `fetchClientsPage(params, cursor, signal)` через `http.get` и `ClientListResponseSchema`; `status` через запятую, `limit` 50 |
| | `queries.ts` | `clientQueries.list(params)` — `infiniteQueryOptions`: ключ `clientKeys.list(params)`, `staleTime` 60 с, `placeholderData: keepPreviousData` |
| | `useClientList.ts` | хук: `clients`, `total`, флаги первой загрузки, ошибки, 403, догрузки, `fetchNextPage`, `retry`, `retryNextPage` |
| | `status.ts` | `CLIENT_STATUS_LABEL`, `CLIENT_STATUS_COLOR_TOKEN` (п. 4.2) |
| | `ClientStatusTag/ClientStatusTag.tsx` | тег статуса: текст + цвет из `theme.useToken()` |
| | `index.ts` | публичный API, реэкспорт контракта из `shared/api` |
| `features/client-filters` | `ClientFilters/ClientFilters.tsx` | поиск (локальный ввод, debounce 300 мс), статус (`Select` multiple), период (`RangePicker` с `allowEmpty`), «Сбросить фильтры» |
| | `useDebouncedCallback.ts` | debounce без внешних зависимостей |
| | `index.ts` | |
| `features/column-settings` | `columnVisibilityStorage.ts` | чтение и запись видимости в `localStorage`: ключ `clients-table:columns:v1:<agentId>`, проверка Zod, неизвестные колонки отбрасываются, ошибки хранилища не ломают таблицу |
| | `useColumnVisibility.ts` | состояние видимости + синхронизация с хранилищем, `reset` |
| | `ColumnSettings/ColumnSettings.tsx` | кнопка «Настроить колонки» → `Popover` с `Checkbox` на колонку и кнопкой «По умолчанию» |
| | `index.ts` | |
| `widgets/clients-table` | `columns.tsx` | `CLIENTS_TABLE_COLUMN` (стабильные id), определения колонок TanStack Table, видимость по умолчанию |
| | `ClientsTable/ClientsTable.tsx` | таблица: TanStack Table (`manualSorting`), `useVirtualizer` (строка 48 px, `overscan` 10), догрузка, все состояния п. 7, сортировка, клавиатура, `initialOffset` из scroll restoration |
| | `ClientsTable/ClientsTable.module.css` | раскладка таблицы на grid, фиксированная высота строки, фокус |
| | `index.ts` | |
| `pages/clients` | `route.ts` | `validateSearch`, `loaderDeps`, `loader` с предзагрузкой (без `await`, чтобы был виден скелетон) |
| | `ClientsPage.tsx` | заголовок со счётчиком, фильтры, настройка колонок, таблица; запись фильтров и сортировки в URL; 403 |
| `app` | `router.tsx` | подключить `route.ts`; `scrollRestoration: true`, `getScrollRestorationKey` с префиксом документа, контейнер таблицы в `scrollToTopSelectors` (§5.3) |

Тесты рядом с кодом: `*.test.ts(x)`; e2e — `e2e/clients.spec.ts`.

## 2. Где хранится состояние

| Состояние | Где |
|---|---|
| Список клиентов, `total`, загруженные порции | кэш TanStack Query (`useInfiniteQuery`), ключ `["clients","list",params]` без курсора |
| `q`, `status`, `from`, `to`, `sort` | URL (`validateSearch`), значения по умолчанию в URL не пишутся |
| Ввод поиска до debounce | `useState` в `ClientFilters` |
| Видимость колонок | `localStorage`, ключ с версией и id агента |
| Позиция прокрутки | scroll restoration TanStack Router (`useElementScrollRestoration` + `initialOffset`) |
| Открыт ли поповер колонок | `useState` в `ColumnSettings` |
| Zustand | не нужен: общего состояния, которое не ложится в строки выше, нет |

## 3. Критерии приёмки → план

| AC | Чем закрывается | Тест |
|---|---|---|
| AC-01 | `useClientList` + скелетон 10 строк в `ClientsTable`; `sort` по умолчанию `registeredAt:desc`; счётчик `total` рядом с заголовком | integration `ClientsPage.test.tsx`: скелетон, затем данные; e2e |
| AC-02 | `columns.tsx`: порядок, форматы (`Intl.DateTimeFormat` `ДД.ММ.ГГГГ` в поясе пользователя, `formatMoney`, `ClientStatusTag`), «Продуктов» скрыта | integration |
| AC-03 | `formatMoney` из `shared/lib/money` в колонке комиссии, выравнивание вправо | integration |
| AC-04 | `ClientFilters`: debounce 300 мс, trim; `toListParams` отбрасывает `q` короче 2 | unit `params.test.ts`; integration: ввод «Иванов» → один запрос |
| AC-05 | `ClientFilters` → URL → `toListParams` → запрос; «Сбросить фильтры» видна при `hasFilters`, сохраняет `sort` | integration |
| AC-06 | новый ключ запроса → первая порция; контейнер таблицы в `scrollToTopSelectors` роутера — сброс к началу при новом переходе | integration (параметры), e2e (прокрутка) |
| AC-07 | `nextSort`, `aria-sort` на `th`, иконка | unit `nextSort`; integration |
| AC-08 | `useVirtualizer` + догрузка при `lastIndex >= length - 10`, `hasNextPage && !isFetchingNextPage` | e2e |
| AC-09 | `ClientsTable`: скелетон / пусто без фильтров / пусто с фильтрами / ошибка первой порции / ошибка догрузки / догрузка (`role="status"`, «Загружаем ещё…») / 403 в `ClientsPage` | integration по каждому состоянию |
| AC-10 | `ClientsSearchSchema` с `.catch`, `formatSort` не пишет значение по умолчанию | unit `schema.test.ts`; integration по ссылке |
| AC-11 | тот же ключ из URL → кэш, `staleTime` 60 с; scroll restoration | e2e |
| AC-12 | фильтры в URL; ключ прокрутки с префиксом документа — после перезагрузки позиция не восстанавливается | e2e |
| AC-13 | `useColumnVisibility` с ключом по агенту; «ФИО» без переключателя; «По умолчанию» | unit storage; integration: перемонтирование, другой агент |
| AC-14 | семантика таблицы (`role` на `table` / `row` / `columnheader` / `cell`), `tabIndex=0` и `Enter` на строке, подписи полей, статус текстом | integration |
| AC-15 | виртуализация, `overscan` 10 | e2e: прокрутка до 10 000 и подсчёт строк |

## 4. Вопросы к спеке

| # | Вопрос | Допущение |
|---|---|---|
| 1 | Как показывать счётчик `total` «в заголовке»: внутри `h2` или рядом? | Рядом с заголовком, отдельным элементом в той же строке. Тогда у заголовка остаётся доступное имя «Мои клиенты», и существующие тесты базы не ломаются |
| 2 | «Задан хотя бы один фильтр»: считать ли фильтром поиск из одного символа? | Нет. Фильтр задан, если он уходит в запрос: `q` от 2 символов после trim, непустой `status`, `from` или `to` |
| 3 | Некорректные значения в URL: отбрасывать параметр целиком или только неверную часть (`status=LEAD,FOO`)? | Для `status` оставляю известные значения, неизвестные отбрасываю; если не осталось ни одного — параметра нет. Остальные параметры — целиком к умолчанию |
| 4 | `from` позже `to` | Передаю как есть, бэкенд вернёт пустой список («Ничего не найдено») |
| 5 | Что показывать в состоянии «Нет доступа», кроме текста? | Только заголовок и сообщение: фильтры и таблица без доступа бессмысленны |
| 6 | Конец списка (conventions §5.2 требует явного состояния, спека его не описывает) | Под последней строкой текст «Показаны все клиенты» |
| 7 | Нужно ли повторять запрос автоматически при ошибке? | Нет, только кнопкой «Повторить» (п. 7); `retry: false` уже в `queryClient` |
| 8 | Ширина колонок | Фиксированная, по содержимому; настройка ширины вне рамок (п. 13 — только видимость) |
