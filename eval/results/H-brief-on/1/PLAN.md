# План: раздел «Мои клиенты»

## Требования из SPEC.md

В спеке нет формальных критериев приёмки, поэтому требования выписаны из текста спеки.

| # | Требование |
|---|---|
| R1 | Таблица показывает ФИО, телефон, статус, дату регистрации, комиссию агента |
| R2 | Поиск по ФИО |
| R3 | Фильтр по статусу |
| R4 | Фильтр по дате регистрации |
| R5 | Сортировка |
| R6 | Подгрузка при прокрутке (бесконечный список) |
| R7 | Клик по клиенту открывает карточку `/clients/$clientId` |
| R8 | Агент настраивает видимые колонки (сохраняется между сессиями) |
| R9 | Данные из `GET /api/agent/clients`, схема из `shared/api` |

## Файлы и слои

| Путь | Слой | Что это |
|---|---|---|
| `entities/client/api.ts` | entities | `fetchClientsPage`: вызов `http.get` с `ClientListResponseSchema` |
| `entities/client/queries.ts` | entities | `clientQueries.list` (`infiniteQueryOptions`), ключ из `clientKeys` |
| `entities/client/useClients.ts` | entities | Хук `useClients(params)`: возвращает предметные поля |
| `entities/client/index.ts` | entities | Публичный API сущности, реэкспорт типов из `shared/api` |
| `features/client-filters/clientsSearch.ts` | features | Zod-схема параметров URL, `validateSearch`, нормализация |
| `features/client-filters/toClientListParams.ts` | features | Параметры URL → `ClientListParams` |
| `features/client-filters/ClientFilters.tsx` | features | Поиск (debounce 300 мс), фильтр статуса, диапазон дат, «Сбросить» |
| `features/client-columns/columnSettings.ts` | features | Zod-схема настроек колонок и чтение/запись `localStorage` |
| `features/client-columns/useColumnSettings.ts` | features | Состояние видимости и порядка колонок, синхронизированное с `localStorage` |
| `features/client-columns/ColumnSettingsButton.tsx` | features | Кнопка «Колонки» с чекбоксами и перемещением |
| `widgets/clients-table/columns.tsx` | widgets | Определения колонок, `id` колонок — константы |
| `widgets/clients-table/ClientsTable.tsx` | widgets | TanStack Table (manual sorting), виртуализация, все состояния таблицы |
| `pages/clients/ClientsPage.tsx` | pages | Сборка: фильтры, настройки колонок, таблица |
| `app/router.tsx` | app | `validateSearch` и `stripSearchParams` для `/clients`, `scrollRestoration`, `scrollToTopSelectors` |
| `e2e/clients.spec.ts` | e2e | Прокрутка, «назад», ссылка с параметрами |

Тесты рядом с кодом: `clientsSearch.test.ts`, `toClientListParams.test.ts`, `columnSettings.test.ts` (unit), `ClientsTable.test.tsx` и `ClientFilters.test.tsx` (интеграционные, Vitest + MSW).

Защищённые файлы не меняются: `shared/api/clients/**`, `http.ts`, `errors.ts`, `lib/money`, `lib/session`, `mocks/**`, `test/**`, `main.tsx`, `package.json`.

## Где хранится состояние

| Состояние | Где | Детали |
|---|---|---|
| Данные клиентов | TanStack Query | Ключ `clientKeys.list({ agentId, q, status, dateFrom, dateTo, sort })`, без номера страницы |
| Поиск, статус, даты, сортировка | URL `/clients?q=&status=&dateFrom=&dateTo=&sort=` | Значения по умолчанию в URL не пишутся (`stripSearchParams`). Поиск пишется с debounce 300 мс и `replace: true` |
| Ввод в поле поиска до debounce | `useState` в `ClientFilters` | Значение синхронизируется с URL при внешней навигации |
| Видимость и порядок колонок | `localStorage`, ключ `clients-table-columns:v1:<agentId>` | Значение проверяется Zod, при ошибке — значение по умолчанию |
| Состояние таблицы (`columnVisibility`, `columnOrder`, `sorting`) | TanStack Table | `sorting` выводится из URL, не копируется |
| Позиция прокрутки | Scroll restoration роутера | `data-scroll-restoration-id="clients-list"`, `useElementScrollRestoration` → `initialOffset` |
| Текущий агент | `useCurrentAgent()` (Zustand в `shared/lib/session`) | Только как часть ключа запроса |

## Покрытие требований

| Требование | Что его закрывает | Тест |
|---|---|---|
| R1 | `columns.tsx`, `ClientsTable.tsx`, формат суммы через `formatMoney` и статус через токены темы | Integration: отображение строки и колонок; E2E |
| R2 | `ClientFilters` (поле поиска), `toClientListParams` (`q`, минимум 2 символа) | Integration: поиск отправляет `q` в запросе; unit: нормализация |
| R3 | `ClientFilters` (Select mode multiple), `status` в URL CSV | Integration: выбор статуса отправляет `status`; unit: отбрасывание неизвестных статусов |
| R4 | `ClientFilters` (DatePicker.RangePicker), `dateFrom`/`dateTo` | Integration: диапазон отправляет даты; unit: невалидная дата → пусто |
| R5 | Заголовки колонок → `sort=field:dir` в URL, `manualSorting: true` | Integration: клик по заголовку меняет `sort` в запросе |
| R6 | `useInfiniteQuery`, `useVirtualizer`, `fetchNextPage` при подходе к концу, состояния «догрузка», «конец списка», «ошибка догрузки» | Integration: догрузка при прокрутке; E2E: прокрутка догружает страницы |
| R7 | `Link` в ячейке ФИО и `navigate` по клику строки на `/clients/$clientId` | Integration: клик открывает карточку; E2E: «назад» |
| R8 | `ColumnSettingsButton` + `useColumnSettings` + `columnSettings.ts` | Unit: чтение `localStorage`; Integration: скрытие, перестановка, переживание перемонтирования |
| R9 | `entities/client/api.ts` через `http.get` и `ClientListResponseSchema` | Integration через MSW; существующие тесты `clientsHandler.test.ts` |

Состояния таблицы: первая загрузка, пусто без фильтров, «ничего не найдено» с фильтрами, ошибка первой страницы с «Повторить», догрузка, ошибка догрузки с «Повторить», конец списка.

## Вопросы к спеке и допущения

1. **Тексты и цвета статусов.** Спека ссылается на п. 4.2, но в файле его нет. Допущение: подписи «Лид», «Счёт открыт», «Финансирован», «Неактивен». Цвета: `LEAD` → `colorStatusNeutral`, `ACCOUNT_OPENED` → `colorStatusInfo`, `FUNDED` → `colorStatusSuccess`, `INACTIVE` → `colorStatusMuted`.
2. **Настройка колонок.** Спека требует выбора видимых колонок. Допущение: скрыть и переставить можно все колонки. Ширину колонок не делаю: спека её не требует, а `shared/api` и тесты для неё ничего не дают. Сохранение ширины потребует отдельного решения.
3. **Сортируемые колонки.** Допущение: сортируются ФИО, дата регистрации и комиссия (их поддерживает мок). Телефон и статус не сортируются.
4. **Поиск.** Допущение: запрос уходит только при длине запроса от 2 символов после `trim` (ограничение мока). Короче 2 символов в URL попадает, но в запрос не уходит.
5. **Даты.** Допущение: даты в `dateFrom`/`dateTo` календарные, границы включительны. Мок сравнивает календарную дату, которая совпадает в UTC и МСК.
6. **Колонки по умолчанию.** Порядок и видимость: все пять колонок в порядке спеки (ФИО, телефон, статус, дата, комиссия).
7. **Настройки колонок** хранятся отдельно для каждого агента (ключ содержит `agentId`).
8. **Ключ запроса содержит `agentId`.** Бэкенд не получает агента в параметрах, поэтому без него кэш при смене агента в одной сессии смешивал бы данные.
9. **Прокрутка после перезагрузки страницы** не восстанавливается: ключ записи уникален для загрузки документа (`getScrollRestorationKey` с префиксом, созданным при загрузке модуля), как описано в `conventions.md` п. 5.3.
10. **`staleTime` списка** задаётся в `clientQueries.list` (5 минут). Без него при возврате из карточки перезапросилась бы первая страница и сбросила бы загруженные строки.
11. **Тесты виртуализатора.** В jsdom размеров нет, поэтому интеграционные тесты подставляют размеры скролл-контейнера через `getBoundingClientRect` в самом тестовом файле. `src/test/**` не меняю.
12. **Статус «Счёт открыт» и комиссия.** Суммы выводятся через `formatMoney` (копейки → рубли).

## Порядок реализации

1. `entities/client` (api, queries, hook, index).
2. `features/client-filters`: схема URL, нормализация, `toClientListParams`, unit-тесты.
3. `features/client-columns`: схема `localStorage`, хук, unit-тесты.
4. `app/router.tsx`: `validateSearch`, `stripSearchParams`, `scrollRestoration`.
5. `widgets/clients-table`: колонки, таблица, виртуализация, состояния, интеграционные тесты.
6. `features/client-filters/ClientFilters.tsx` и `features/client-columns/ColumnSettingsButton.tsx`.
7. `pages/clients/ClientsPage.tsx`.
8. `e2e/clients.spec.ts`.
9. `npm run check`, `npm run test:e2e`, исправления до прохождения.

## Фактические отклонения от плана

- **Поля `ClientsSearch` необязательны.** Маршрут `/clients` обязан принимать переходы без параметров (редирект с `/`, «Назад», 404). Обязательные поля потребовали бы `search` во всех таких переходах. Значения нормализуются при чтении: `q` обрезается, статусы фильтруются, сортировка подставляется по умолчанию.
- **Даты — два `DatePicker`, а не `RangePicker`.** У каждого свой `aria-label`, поэтому поля доступны по роли и имени.
- **Статусы в `Select` без виртуализации (`virtual={false}`).** Вариантов четыре. С виртуализацией выбор не срабатывал в jsdom.
- **«Сбросить» очищает поиск, статус и даты, сортировку оставляет.** Это допущение: спека не говорит, что сбрасывать.
- **Стаб размеров для jsdom — `clientHeight`/`clientWidth`, а не `getBoundingClientRect`.** Виртуализатор читает именно эти свойства.
- **Тесты в `src/pages/clients/ClientsPage.test.tsx`** покрывают таблицу целиком через приложение (состояния, фильтры, сортировка, догрузка, колонки, переход на карточку). Unit-тесты на схему URL и `localStorage` лежат рядом с кодом.
- **E2E в `e2e/clients.spec.ts`:** догрузка при прокрутке; «назад» с восстановлением фильтров, загруженных строк, позиции прокрутки и без повторного запроса первой страницы; ссылка с параметрами.
- **Ключ восстановления прокрутки уникален для загрузки документа** (`SCROLL_RESTORATION_PREFIX` в `app/router.tsx`). После перезагрузки страницы прокрутка начинается сверху, фильтры при этом берутся из URL.
