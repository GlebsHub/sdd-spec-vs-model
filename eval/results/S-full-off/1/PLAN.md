# План: раздел «Мои клиенты»

## 1. Файлы и слои (FSD, плоская структура слайсов)

Реализация идёт снизу вверх: схема → API → запросы → состояние → UI.

### `entities/client` (доменная модель; контракт API реэкспортируется из `shared/api`)

| Файл | Назначение |
|---|---|
| `schema.ts` | Реэкспорт схем из `shared/api`. Новое: `ClientsSearchSchema` — Zod-схема параметров URL (`q`, `status`, `from`, `to`, `sort`), у каждого поля `.catch` (мусор игнорируется) |
| `types.ts` | Типы через `z.infer`: `ClientsSearch`, `ClientListParams`, `ClientSort` |
| `constants.ts` | `CLIENT_COLUMN` (стабильные id колонок), метаданные колонок (заголовок, видимость по умолчанию, можно ли скрыть), `CLIENT_STATUS_LABEL`, `PAGE_SIZE = 50`, `DEFAULT_SORT`, `CLIENTS_STALE_TIME_MS = 60_000` |
| `search.ts` | Чистые функции: `parseClientsSearch(raw)`, `toListParams(search)` (URL → параметры API: `from→dateFrom`, `to→dateTo`), `hasActiveFilters`, `nextSort` |
| `api.ts` | `fetchClients(params, cursor, signal)` → `http.get("/agent/clients", { schema })`, `limit=50`, статусы через запятую |
| `queries.ts` | `clientQueries.list(params)` — `infiniteQueryOptions`, ключ `clientKeys.list(params)`, `placeholderData: keepPreviousData`, `staleTime` 60 с, явный `gcTime`, `retryOnMount: false` |
| `useClients.ts` | Хук чтения списка: предметные поля (`clients`, `total`, `isPending`, `isError`, `isForbidden`, `isFetchingNextPage`, `isNextPageError`, `hasNextPage`, `fetchNextPage`, `retry`...) |
| `ClientStatusTag.tsx` | Тег статуса: текст + цвет из токенов темы |
| `format.ts` | `formatRegisteredAt` (`ДД.ММ.ГГГГ`, часовой пояс пользователя) |
| `index.ts` | Публичный API |

### `features`

- `features/clients-filters`: `ClientsFilters.tsx` (поиск, статус, период, «Сбросить фильтры»), `useClientsSearch.ts` (чтение URL через `getRouteApi("/clients")`, запись фильтров и сортировки в URL, `resetFilters`), `useSearchInput.ts` (текст поля до debounce 300 мс, `useState`), `ClientsFilters.module.css`.
- `features/column-settings`: `ColumnSettings.tsx` (кнопка «Настроить колонки», выпадающая панель с чекбоксами и «По умолчанию»), `useColumnVisibility.ts` (состояние + `localStorage`), `storage.ts` (чтение/запись с проверкой Zod, ключ с версией и id агента).

### `widgets/clients-table`

- `ClientsTable.tsx` — сборка блока: заголовок со счётчиком, панель фильтров, настройка колонок; выбор между таблицей и состояниями (пусто, ошибка, нет доступа).
- `ClientsGrid.tsx` — таблица на TanStack Table + виртуализация (`useVirtualizer`), один скролл-контейнер, скелетон на 10 строк, индикаторы догрузки и ошибки догрузки.
- `columns.tsx` — определения колонок (`id` = константы из сущности).
- `useLoadMore.ts` — условие догрузки (остаток ≤ 10 строк, `hasNextPage && !isFetchingNextPage`).
- `constants.ts` (высота строки, overscan, порог), `ClientsTable.module.css`, `index.ts` (экспортирует также `CLIENTS_SCROLL_ID`).

### `shared/lib/scroll-restoration`

`getScrollRestorationKey` — ключ записи истории с префиксом документа. Нужен и роутеру, и `useElementScrollRestoration` (хук не читает ключ из опций роутера), поэтому лежит в `shared`.

### `pages/clients`

`ClientsPage.tsx` (собирает виджет), `route.ts` (`validateClientsSearch`, `clientsLoaderDeps`, `loadClients`), `index.ts`.

### `app`

`router.tsx`: у маршрута `/clients` — `validateSearch`, `loaderDeps`, `loader`; в `createRouter` — `scrollRestoration: true`, `scrollToTopSelectors`, `getScrollRestorationKey` с префиксом документа, свои `parseSearch`/`stringifySearch` (`searchParams.ts`), чтобы URL был вида `status=LEAD,FUNDED&sort=commissionKopecks:asc`.

### Тесты

- Unit: `entities/client/search.test.ts`, `app/searchParams.test.ts`, `features/column-settings/storage.test.ts`.
- Интеграционные (Vitest + MSW + `renderApp`): `widgets/clients-table/ClientsTable.test.tsx`.
- E2E (Playwright): `e2e/clients.spec.ts`.

## 2. Где хранится состояние

| Состояние | Где |
|---|---|
| Список клиентов, `total`, курсоры | Кэш TanStack Query (`useInfiniteQuery`, ключ `clientKeys.list(params)` без номера страницы) |
| Поиск `q`, статусы `status`, период `from`/`to`, сортировка `sort` | Параметры URL; единственный источник истины |
| Видимость колонок | `localStorage`, ключ `agent-cabinet:clients:columns:v1:<agentId>`, значение проверяется Zod |
| Позиция прокрутки | Scroll restoration роутера (`data-scroll-restoration-id`, `useElementScrollRestoration`) |
| Текст в поле поиска до debounce, открыта ли панель колонок | `useState` в своём компоненте |
| Zustand | Не нужен (агент приходит из `useCurrentAgent()`) |

Query-ключи: `clientKeys.list({ q, status, dateFrom, dateTo, sort })`. Параметры URL: `q`, `status`, `from`, `to`, `sort`.

## 3. Соответствие критериям приёмки

| AC | Что закрывает | Тест |
|---|---|---|
| AC-01 | `useClients` + `ClientsTableSkeleton` (10 строк) + заголовок со счётчиком; сортировка по умолчанию `registeredAt:desc` | интеграционный: скелетон → данные, счётчик; e2e |
| AC-02 | `columns.tsx`, `constants.ts`, `ClientStatusTag`, `formatRegisteredAt`; «Продуктов» скрыта по умолчанию | интеграционный: заголовки, порядок, формат ячеек |
| AC-03 | `formatMoney` в ячейке, `text-align: right` | интеграционный: `1 234 567` коп. → `12 345,67 ₽`, `0,05 ₽`, `0,00 ₽` |
| AC-04 | Поле поиска: `useState` + debounce 300 мс, порог 2 символа после trim, запись в URL с `replace` | интеграционный: посимвольный ввод «Иванов» → один запрос с `q=Иванов` |
| AC-05 | `ClientsFilters` + `toListParams`; кнопка сброса по `hasActiveFilters`, сохраняет `sort` | интеграционный: параметры запроса, видимость кнопки, сортировка после сброса |
| AC-06 | Новая запись URL → новый query-ключ → первая порция; `scrollToTopSelectors` в роутере | интеграционный: параметры запроса; e2e: прокрутка к началу |
| AC-07 | `nextSort` + `enableSortingRemoval: false`, `sortDescFirst`; иконка и `aria-sort` в заголовке | интеграционный: цикл desc → asc → desc, `aria-sort`; unit `nextSort` |
| AC-08 | Виртуализатор: догрузка при остатке ≤ 10 строк, условие `hasNextPage && !isFetchingNextPage`; остановка при `nextCursor = null` | e2e: прокрутка догружает; интеграционный: индикатор «Загружаем ещё…» |
| AC-09 | `ClientsTableState`, индикатор догрузки (`role="status"`), ошибка догрузки с «Повторить» (`fetchNextPage`), 403 | интеграционные по всем сценариям мока: `error-first-page`, `error-next-page`, `empty`, `forbidden`, `network-error`, `malformed`, пусто с фильтрами |
| AC-10 | `ClientsSearchSchema` + `validateSearch`, кастомный `stringifySearch`; значения по умолчанию в URL не пишутся | unit: парсинг, мусор, round-trip; интеграционный: открытие по ссылке |
| AC-11 | Фильтры в URL → тот же ключ; `staleTime` 60 с; scroll restoration | интеграционный: переход в карточку и «назад» без нового запроса; e2e: строка перехода видна |
| AC-12 | Параметры в URL переживают перезагрузку; ключ восстановления прокрутки с префиксом документа | e2e: `page.reload()` |
| AC-13 | `features/column-settings`: `localStorage` по агенту, «ФИО» заблокирована, «По умолчанию» | unit: `storage.ts`; интеграционный: перемонтирование, два агента, сброс |
| AC-14 | Строки `tabIndex=0` + `Enter`; подписи полей; статус текстом | интеграционный: Tab/Enter, `getByRole` по подписям |
| AC-15 | `useVirtualizer` с `overscan: 10`, фиксированная высота строки | e2e: 10 000 строк в кэше → ≤ 60 строк в DOM |

## 4. Вопросы к спеке и принятые допущения

1. **Счётчик в заголовке.** «Заголовок со счётчиком» — число выводится в том же `h2` отдельным `span`; доступное имя заголовка задано `aria-label="Мои клиенты"`. Формат числа — `ru-RU` (`10 000`).
2. **Смена фильтров и скелетон.** Скелетон показывается, только когда данных нет совсем. При смене фильтров прежний список остаётся (`keepPreviousData`), пока грузится новый (требование conventions, п. 5.2).
3. **Поиск короче 2 символов.** В URL и API `q` не попадает. Введённый текст остаётся в поле. Значение `q` из URL короче 2 символов после trim игнорируется. «Сбросить фильтры» показывается по применённым фильтрам (из URL), а не по тексту в поле.
4. **Некорректные элементы `status`.** Неизвестные значения отбрасываются, остальные применяются (`status=LEAD,BOGUS` → `LEAD`). Порядок статусов канонический (как в п. 4.2), дубли убираются.
5. **Период.** `from > to` не исправляется, запрос уходит как есть (сравнивает бэкенд). Невалидная календарная дата игнорируется.
6. **`sort` по умолчанию.** `sort=registeredAt:desc` в URL трактуется как «не задана»; в API параметр `sort` в этом случае не передаётся.
7. **Формат ввода дат.** В поле выбора периода — `ДД.ММ.ГГГГ` (локаль ru), в URL и API — `YYYY-MM-DD` без пересчёта часового пояса.
8. **Часовой пояс даты регистрации.** Часовой пояс браузера (`dayjs` в локальной зоне).
9. **Вид URL.** Стандартный сериализатор роутера дал бы JSON (`status=["LEAD"]`). Чтобы URL совпадал с п. 9.1, подключены собственные `parseSearch`/`stringifySearch`: значения — строки, массивы — через запятую, `,` и `:` не экранируются.
10. **`aria-sort`.** Ставится только у отсортированной колонки (`ascending`/`descending`), у остальных атрибута нет.
11. **«ФИО» в настройках колонок.** Показана как включённый и заблокированный чекбокс. Из `localStorage` берутся только известные колонки, неизвестные ключи игнорируются, значение для «ФИО» всегда `true`. При невалидном JSON или схеме — значения по умолчанию.
12. **«По умолчанию».** Удаляет запись из `localStorage` и возвращает набор по умолчанию.
13. **Сохраняется только видимость.** Порядок и ширина колонок вне рамок (п. 13 спеки), хотя conventions п. 5.4 упоминает их.
14. **403.** Показывается только заголовок и сообщение, панель фильтров скрыта. Остальные ошибки первой порции — сообщение с «Повторить» под панелью фильтров.
14а. **Две кнопки «Сбросить фильтры».** В состоянии «Ничего не найдено» кнопка есть и в панели фильтров (п. 5), и в самом состоянии (п. 7). Чтобы на экране не было двух одинаковых кнопок, в этом состоянии остаётся кнопка внутри состояния, а кнопка панели скрывается.
15. **Фоновое обновление с ошибкой.** Если при возврате старше 60 с обновление упало, показанные строки остаются без сообщения.
16. **Loader.** Предзагрузка в `loader` не блокирует переход (`void prefetchInfiniteQuery`), иначе скелет не успеет показаться. Из-за этого у запроса `retryOnMount: false`: ошибку предзагрузки показывает компонент, повтор — кнопкой «Повторить».
17. **Окружение без раскладки (jsdom).** Виртуализатор при нулевой высоте контейнера получает запасную высоту видимой области, иначе не отрисуется ни одной строки. В браузере не влияет.
18. **Конец списка.** Под последней строкой при `nextCursor = null` выводится «Больше клиентов нет» (conventions п. 5.2); спека этого не требует.
19. **Прокрутка после перезагрузки** не восстанавливается: ключ `getScrollRestorationKey` содержит префикс, создаваемый при загрузке модуля.
