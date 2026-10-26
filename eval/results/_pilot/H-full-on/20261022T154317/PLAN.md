# План: раздел «Мои клиенты»

## 1. Файлы и слои

| Слой | Файлы | Назначение |
|---|---|---|
| `app` | `router.tsx` (правка) | `validateSearch` маршрута `/clients`; `scrollRestoration: true`; `getScrollRestorationKey` с префиксом на загрузку документа; `scrollToTopSelectors` с контейнером списка |
| `entities/client` (новый) | `searchParams.ts` | Схема параметров адреса, нормализация, перевод адреса в параметры API |
| | `searchParams.test.ts` | Unit: значения по умолчанию, мусор, `q` < 2 символов, канонический `sort` |
| | `api.ts` | `fetchClients(params, signal)` через `http.get` и `ClientListResponseSchema` из `shared/api` |
| | `queries.ts` | `clientQueries.list(params)`: `infiniteQueryOptions` с `clientKeys.list`, `staleTime: 60_000`, `keepPreviousData` |
| | `useClients.ts` | Хук чтения: `{ clients, total, hasNextPage, ... }`, без `...rest` |
| | `labels.ts` | Тексты статусов (п. 4.2) и опции фильтра |
| | `index.ts` | Публичный API слайса |
| `features/client-filters` (новый) | `ClientFilters.tsx`, `index.ts` | Поиск (debounce 300 мс), статус, период, «Сбросить фильтры». Пишет в URL |
| | `ClientFilters.test.tsx` | Интеграция: один запрос при посимвольном вводе, сброс, видимость кнопки |
| `features/client-columns` (новый) | `useColumnVisibility.ts`, `ColumnSettings.tsx`, `index.ts` | Видимость колонок в `localStorage` с версией и `agentId`, кнопка «Настроить колонки», «По умолчанию» |
| | `useColumnVisibility.test.ts` | Unit: чтение `localStorage`, невалидные данные, сбой доступа |
| `widgets/clients-table` (новый) | `ClientsTable.tsx`, `columns.tsx`, `ClientsTable.module.css`, `index.ts` | Панель фильтров, настройка колонок, таблица TanStack Table, виртуализация, все состояния п. 7 |
| | `ClientsTable.test.tsx` | Интеграция: состояния, сортировка, колонки, Enter, перемонтирование |
| `pages/clients` (правка) | `ClientsPage.tsx` | Заголовок «Мои клиенты», счётчик `total`, виджет |
| `shared` | без изменений | Используются `clients/` (схемы, ключи), `lib/money`, `lib/session`, `ui` (токены статусов) |

Защищённые файлы не меняются: `src/shared/api/clients/**`, `src/mocks/**`, `src/test/**`, `src/shared/lib/money/**`, `src/shared/lib/session/**`, `src/main.tsx`, конфиги, `e2e/smoke.spec.ts`.

Зависимости не добавляются. Используются уже установленные TanStack Router, Query, Table, Virtual, Zustand (не нужен, см. §2), Ant Design, dayjs, Zod.

Сборка страницы: `pages/clients` → `widgets/clients-table` → `features/client-filters`, `features/client-columns` → `entities/client` → `shared`. Импорты только через `index.ts`.

Предзагрузочный `loader` не используется: скелетон при первой загрузке требуется спецификацией (AC-01), поэтому данные запрашивает хук в виджете.

## 2. Где хранится состояние

| Состояние | Где | Комментарий |
|---|---|---|
| Поиск, статус, период, сортировка | URL (`/clients?q&status&from&to&sort`) | Единственный источник истины. Значения по умолчанию в URL не пишутся, `sort` по умолчанию (`registeredAt:desc`) опускается |
| Список клиентов, `total` | Кэш TanStack Query, ключ `clientKeys.list(apiParams)` | Ключ содержит только параметры, влияющие на ответ: `q` берётся только при длине ≥ 2 |
| Текст в поле поиска до debounce | `useState` в `ClientFilters` | Синхронизируется с URL, только если URL изменился извне |
| Видимость колонок | `localStorage`, ключ `clients-columns:v1:<agentId>` | Значение `{ hidden: string[] }`, проверяется Zod. Порядок и ширина не сохраняются (п. 13 вне рамок, порядок фиксирован) |
| Позиция прокрутки | Механизм scroll restoration роутера, `useElementScrollRestoration({ id: "clients-list" })` | Передаётся в `initialOffset` виртуализатора |
| Текущий агент | `useCurrentAgent()` (существующий Zustand-стор сессии, не трогается) | Нужен для ключа `localStorage` |
| Открыт ли попап колонок | `useState` в `ColumnSettings` | |

Zustand-стора для раздела не создаётся: ни одно состояние не подходит под «общее состояние несвязанных компонентов».

## 3. Пути через URL

- Адрес → `validateSearch` (`entities/client/searchParams.ts`): строки, некорректные значения отбрасываются, `status` сохраняется как канонический список через запятую, `sort` без значения по умолчанию.
- Параметры адреса → параметры API: `from`→`dateFrom`, `to`→`dateTo`, `status` → массив, `q` → только при длине ≥ 2 после `trim`.
- Текстовый поиск: URL получает `trim`-значение длиной ≥ 1 после debounce 300 мс, `replace: true`. Дискретные изменения (статус, период, сортировка) — `push`.
- Сбрасывает `q`, `status`, `from`, `to`; `sort` сохраняется.

## 4. Таблица и виртуализация

- `useReactTable`: `manualSorting: true`, `manualFiltering: true`, колонки в `columns.tsx`, `id` — константы: `fullName`, `phoneMasked`, `status`, `registeredAt`, `commissionKopecks`, `productsCount`. `fullName` — `enableHiding: false`.
- Сортировка: состояние из URL. Клик по колонке: другая или не отсортированная → `desc`; `desc` → `asc`; `asc` → `desc`. `aria-sort` и иконка на `th`.
- Таблица — семантический `<table>` с `thead` (sticky) и двумя `tr`-распорками сверху и снизу для виртуализации. Строка фиксированной высоты 48 px, `overscan: 10`, `getItemKey` по `id`.
- `initialOffset` = `scrollY` из `useElementScrollRestoration`.
- Догрузка: эффект по `virtualizer.range.endIndex`. Если `endIndex >= loaded.length - 10` и `hasNextPage && !isFetchingNextPage` → `fetchNextPage()`. Для AC-08 и AC-15 важен именно видимый диапазон, а не диапазон с запасом.
- Строка: `tabIndex={0}`, `onClick` и `Enter` → `navigate({ to: "/clients/$clientId", params })`.
- Контейнер со скроллом всегда смонтирован и помечен `data-scroll-restoration-id="clients-list"`, селектор добавлен в `scrollToTopSelectors`.

## 5. Состояния (п. 7)

| Состояние | Условие | Реализация |
|---|---|---|
| Первичная загрузка | `isPending` | `Skeleton` на 10 строк, фильтры доступны |
| Догрузка | `isFetchingNextPage` | `Text role="status"` «Загружаем ещё…» под последней строкой |
| Пусто без фильтров | `total === 0`, фильтров нет | Текст из п. 7 |
| Пусто с фильтрами | `total === 0`, есть фильтр | «Ничего не найдено» + «Сбросить фильтры» |
| Ошибка первой порции | `isError && нет данных` | «Не удалось загрузить клиентов» + «Повторить» (`refetch`) |
| Ошибка догрузки | `isFetchNextPageError` | Строки остаются, строка-сообщение + «Повторить» (`fetchNextPage`) |
| Нет доступа | `HttpError` со статусом 403 | «Раздел недоступен. Обратитесь к персональному менеджеру» |

Для 403 и 5xx различие делает `isHttpError(error, 403)` из `shared/api`.

## 6. Кэш и возврат

- `staleTime: 60_000` в `clientQueries.list` → при возврате с карточки данные из кэша без запроса в пределах 60 с, иначе показываются и обновляются в фоне.
- `gcTime` по умолчанию 10 минут из `createQueryClient`, больше типичного ухода со списка.
- `keepPreviousData` при смене фильтров: старые строки не мигают, прокрутка сбрасывается роутером.

## 7. Деньги и даты

- `formatMoney` из `shared/lib/money`, правое выравнивание через стиль колонки.
- Дата: `dayjs(registeredAt).format("DD.MM.YYYY")`. Браузер в тестах — `Europe/Moscow`.
- Период: `DatePicker.RangePicker` с `allowEmpty` для обеих сторон. Значение в адрес — `format("YYYY-MM-DD")` без пересчёта часового пояса.

## 8. Тесты (требование → тест)

| Требование | Тест |
|---|---|
| Адрес: значения по умолчанию, мусор, `q` < 2, канонический `status`/`sort` (§8 conventions, п. 9.1) | `searchParams.test.ts` |
| Параметры запроса из адреса (`from`→`dateFrom`, `status`→массив), ключ без `q` короче 2 | `searchParams.test.ts` |
| Видимость колонок из `localStorage`, версия, невалидные данные, сбой доступа (п. 10) | `useColumnVisibility.test.ts` |
| AC-01, AC-02, AC-03: скелетон, колонки, форматы, `0` и `5` копеек | `ClientsTable.test.tsx` |
| AC-04: один запрос `q=Иванов` при посимвольном вводе, `q` короче 2 не отправляется | `ClientFilters.test.tsx` |
| AC-05, AC-06: статус и период в запросе, сброс без сортировки, первая порция при смене | `ClientFilters.test.tsx`, `ClientsTable.test.tsx` |
| AC-07: сортировка по кругу, `aria-sort` | `ClientsTable.test.tsx` |
| AC-08: догрузка, стоп при `nextCursor = null` | `e2e/clients.spec.ts` (нужна раскладка браузера) |
| AC-09: все состояния п. 7, догрузка не удаляет строки | `ClientsTable.test.tsx` (ошибка и повтор), `e2e/clients.spec.ts` |
| AC-10: URL-параметры, открытие по ссылке, некорректные значения | `App`-тест `ClientsTable.test.tsx` через `renderApp` и `e2e/clients.spec.ts` |
| AC-11: «назад» без повторного запроса, строка видна | `e2e/clients.spec.ts` |
| AC-12: перезагрузка сохраняет фильтры | `e2e/clients.spec.ts` |
| AC-13: колонки по агенту, «ФИО» нельзя скрыть, «По умолчанию» | `ClientsTable.test.tsx`, `useColumnVisibility.test.ts` |
| AC-14: клавиатура, `Enter`, подписи полей, статус текстом | `ClientsTable.test.tsx` |
| AC-15: ≤ 60 строк в DOM при 10 000 загруженных | `ClientsTable.test.tsx` (с замером `clientHeight`) или `e2e/clients.spec.ts` |

В jsdom `clientHeight` равен 0, поэтому в тестах таблицы размер контейнера задаётся через `Object.defineProperty` на `HTMLElement.prototype` в самом тестовом файле (`src/test/**` не меняется).

## 9. Вопросы к спеке и принятые допущения

1. **Тайминг запроса по порогу догрузки.** Спецификация: «до конца загруженных строк остаётся 10 строк или меньше». Допущение: считается по последней видимой строке (`virtualizer.range.endIndex`), без учёта запаса `overscan`.
2. **Поиск короче 2 символов в адресе.** Спецификация: «параметр `q` не передаётся» при длине 0–1. Допущение: адрес хранит введённое `trim`-значение длиной ≥ 1 (чтобы не терять текст при возврате), а в запрос и ключ кэша `q` попадает только при длине ≥ 2.
3. **Кнопка «Сбросить фильтры»** видна, если в адресе есть `q` (любой длины), `status`, `from` или `to`.
4. **Сортировка «не отсортирована».** Сортировка всегда активна (есть значение по умолчанию), поэтому клик по любой сортируемой колонке, которая не сортирует, даёт `desc`.
5. **Скролл-контейнер после перезагрузки.** Спецификация: позиция не восстанавливается. Допущение: `getScrollRestorationKey` с префиксом, созданным при загрузке модуля, по конвенции §5.3.
6. **Направление сортировки в адресе.** `sort` опускается только при значении по умолчанию `registeredAt:desc`; любой другой выбор пишется явно.
7. **Ключ `localStorage`.** `clients-columns:v1:<agentId>`. Версия в ключе, при несовпадении схемы используется значение по умолчанию.
8. **Конфликт конвенций §5.2 и спеки.** Конвенция требует `keepPreviousData`, спека (п. 7) — отдельный скелетон при первой загрузке. Допущение: скелетон только при отсутствии данных (`isPending` без `placeholderData`), смена фильтров показывает прежние строки.
9. **Колонка «Продуктов»** скрыта по умолчанию (п. 4.1), в список настройки входят все колонки, кроме «ФИО».
10. **Ошибка 403 при догрузке** трактуется как ошибка догрузки, а не «Нет доступа» (спека относит «Нет доступа» к запросу первой порции).

## 10. Порядок реализации

1. `entities/client`: `searchParams.ts` + unit-тест, `api.ts`, `queries.ts`, `useClients.ts`, `labels.ts`, `index.ts`.
2. `app/router.tsx`: `validateSearch`, `scrollRestoration`, `scrollToTopSelectors`.
3. `features/client-columns`: хук и настройка, unit-тест.
4. `features/client-filters`: поля фильтров, debounce, сброс, тест.
5. `widgets/clients-table`: колонки, таблица, виртуализация, состояния, тесты.
6. `pages/clients`: сборка.
7. `e2e/clients.spec.ts`: прокрутка, карточка и «назад», перезагрузка, ссылка с параметрами.
8. `npm run check`, `npm run test:e2e`, правка до зелёного без изменения тестов и спеки.

## 11. Отклонения от плана (факт)

- Параметры адреса: `validateSearch` возвращает все ключи явно (`undefined` для отброшенных). TanStack сливает результат с сырым адресом через `Object.assign`, иначе некорректное значение остаётся в запросе.
- Метаданные колонок: вместо расширения `ColumnMeta` (module augmentation с неиспользуемыми параметрами типа, линтер) описания колонок лежат в `columns.tsx` (`CLIENT_COLUMNS`, `findClientColumn`). `StatusTag` вынесен в отдельный файл, чтобы `columns.tsx` экспортировал только данные.
- Поле «Статус»: `virtual={false}`. Список из четырёх пунктов, виртуализация не нужна; без неё опции не рендерятся в jsdom.
- `clients` мемоизируется по `data` в `useClients`, в таблице задано `manualPagination: true`. Без этого TanStack сбрасывал страницу на каждом рендере и получался бесконечный цикл обновлений.
- Счётчик «Мои клиенты» берётся из `useClients` на странице (тот же ключ кэша, один запрос).
- Период регистрации: `role="group"` с подписью вместо `aria-label` на обоих полях (у RangePicker поля одинаково подписаны).
- Группа сортировки: `aria-sort="none"` у сортируемых колонок, которые сейчас не сортируют.
- E2E-тесты AC-08 и AC-15 проверяют догрузку и ограничение DOM на нескольких порциях, а не на всех 10 000 строках (это заняло бы сотни запросов).
- Не покрыто тестами UI выбора периода (RangePicker). Параметры периода проверены через адрес (AC-10).
