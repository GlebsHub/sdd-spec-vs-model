# План: раздел «Мои клиенты»

## 1. Файлы и слои

Ограничения из `CLAUDE.md`: защищённые файлы не трогаем (`shared/api/clients/**`, `shared/api/http.ts`, `shared/api/errors.ts`, `shared/lib/money/**`, `shared/lib/session/**`, `src/mocks/**`, `src/test/**`, `src/main.tsx`, конфиги, `package.json`). Редактируем только `src/app/router.tsx` (не защищён) и `src/pages/clients/`.

| Слой | Файл | Назначение |
|---|---|---|
| entities | `src/entities/client/api.ts` | `fetchClients(params)`: сериализация параметров (массив статусов в строку через запятую, `limit=50`, `cursor`), вызов `http.get` со схемой `ClientListResponseSchema` |
| entities | `src/entities/client/queries.ts` | `clientQueries.list(params)` — `infiniteQueryOptions` с `queryKey: clientKeys.list(params)`, `staleTime` 60 с, `getNextPageParam: (last) => last.nextCursor` |
| entities | `src/entities/client/useClients.ts` | Хук чтения: возвращает `{ clients, total, isPending, isError, isFetchingNextPage, hasNextPage, fetchNextPage, refetch, isNextPageError }` |
| entities | `src/entities/client/index.ts` | Публичный API. Реэкспорт `Client`, `ClientStatus`, `CLIENT_STATUS`, `clientKeys` из `shared/api` |
| shared/ui | `src/shared/ui/...` | Пока без новых компонентов (правило: в два и более мест) |
| features | `src/features/clients-filters/` | Панель фильтров: поиск (`useDebouncedSearch`, 300 мс), статус (Select multiple), период (RangePicker), кнопка «Сбросить фильтры». Пишет в URL через `useNavigate`/`Route.useSearch` |
| features | `src/features/clients-sort/` | `nextSort(current, field)` — переключение `desc → asc → desc`; `aria-sort`, иконка. Пишет `sort` в URL |
| features | `src/features/clients-columns/` | Видимость колонок в `localStorage` через хук `useColumnVisibility` (TanStack Table `columnVisibility`). Кнопка «Настроить колонки» (Popover + Checkbox), кнопка «По умолчанию». Zustand не используется |
| widgets | `src/widgets/clients-table/` | `ClientsTable` (TanStack Table, `manualSorting`, `manualFiltering`), `columns.tsx` (стабильные `id`), виртуализация `useVirtualizer` (`estimateSize`, `overscan: 10`), скролл-контейнер с `data-scroll-restoration-id="clients-table"`, `useElementScrollRestoration({ id })`, `initialOffset`, пагинация при `nextIndex >= rows.length - 10` |
| pages | `src/pages/clients/ClientsPage.tsx` | Сборка: заголовок с `total`, фильтры, кнопка колонок, таблица. Читает `Route.useSearch()` |
| app | `src/app/router.tsx` | `validateSearch` (Zod) для `/clients`: `q`, `status`, `from`, `to`, `sort`; `scrollRestoration: true`; `getScrollRestorationKey` с префиксом, созданным один раз при загрузке модуля (см. 5.3, перезагрузка не восстанавливает позицию) |

Ключ `scrollToTopSelectors` задаётся в `createRouter`: `[data-scroll-restoration-id="clients-table"]`.

Схема `validateSearch` и парсинг/сериализация URL ↔ API лежат в `src/entities/client/search.ts` (unit-тестируемо без React).

## 2. Где хранится состояние

| Состояние | Где | Почему |
|---|---|---|
| Список клиентов, `total` | TanStack Query (`infiniteQuery`), ключ `clientKeys.list({ q, status, dateFrom, dateTo, sort })` | Кэш, дедупликация, 60 с свежести |
| `q`, `status`, `from`, `to`, `sort` | URL (`validateSearch`) | Ссылка, «назад», перезагрузка (AC-10, AC-11, AC-12) |
| Видимость колонок | `localStorage`, ключ `clients-columns:v1:<agentId>`, Zod-проверка | Между сессиями, отдельно для агента (AC-13) |
| Позиция прокрутки | Scroll restoration роутера | AC-11 |
| Ввод поиска до debounce | `useState` в `ClientSearchInput` | Локально |
| Открыт ли Popover колонок | `useState` | Локально |
| `agentId` | `useCurrentAgent()` из `shared/lib/session` | Ключ `localStorage` |

Zustand не используется: ни одно состояние не попадает под последний уровень.

## 3. Query-ключи

- `clientKeys.list(params)` из `shared/api/clients/keys.ts`. Params = `{ q?, status?, dateFrom?, dateTo?, sort }` — нормализованный объект из URL (без `cursor`, `limit`).
- Фильтры в ключе передаются нормализованными (`status` — отсортированный массив), чтобы `LEAD,FUNDED` и `FUNDED,LEAD` не давали двух записей кэша.
- Инвалидации не нужны.

## 4. Параметры URL

| URL | API | Правило |
|---|---|---|
| `q` | `q` | trim, от 2 символов, иначе не передаётся (AC-04) |
| `status` | `status` | `LEAD,FUNDED`, неизвестные значения отбрасываются |
| `from` | `dateFrom` | `YYYY-MM-DD`, некорректное → не задано |
| `to` | `dateTo` | то же |
| `sort` | `sort` | `поле:направление`, по умолчанию `registeredAt:desc` не пишется в URL |

Некорректные значения → значение по умолчанию (`validateSearch` через `.catch()`). Значения по умолчанию в URL не пишутся.

Поиск пишется в URL с debounce 300 мс и `replace: true`. Статус, период, сортировка — `push` (новая запись истории).

## 5. Допущения (вопросы к спеке)

1. **Поиск и debounce.** Спека: запрос уходит через 300 мс после последнего изменения поля. Допущение: debounce работает на уровне ввода — URL обновляется через 300 мс, отсюда запрос. Пробелы по краям: `"  Иванов "` → `q=Иванов`.
2. **Поиск короче 2 символов (изменено при реализации).** В URL `q` пишется всегда, если он непуст после trim, чтобы поле ввода и адрес не расходились при debounce. В запрос к API `q` уходит только при длине от 2 символов. Один символ не считается активным фильтром: кнопка «Сбросить фильтры» скрыта, пустой результат — «У вас пока нет клиентов».
3. **Исходные ключи адреса.** TanStack Router сохраняет исходное значение ключа, которого нет в результате `validateSearch`. Поэтому `parseClientsSearch` возвращает все пять ключей явно, отсутствующие — как `undefined`. Иначе `from=2026-02-30` дошёл бы до API.
4. **Сортировка и сброс фильтров.** Сортировка не сбрасывается кнопкой «Сбросить фильтры» (AC-05).
5. **Период.** Допущение: частично заданный период (только `from`) допустим, `to` без `from` тоже. Одна дата приходит как `from` или `to` без второй.
6. **Смена фильтра или сортировки.** Прокрутка к началу через scroll restoration (`scrollToTopSelectors`), без ручного `scrollToOffset(0)` (conventions 5.3). Проверяется e2e и unit-тестом наличия селектора.
7. **«Назад» и 60 секунд.** Стандартный `gcTime` и `staleTime` 60 с дают ровно то поведение: в пределах 60 с кэш без запроса, после — показ строк и фоновое обновление (SWR: `refetchOnMount` при `isStale`). Ключ — по URL, поэтому тот же запрос.
8. **Перезагрузка.** Позиция прокрутки не восстанавливается: `getScrollRestorationKey` с уникальным на документ префиксом (conventions 5.3). Фильтры восстанавливаются из URL.
9. **Видимость колонок и `agentId`.** Ключ `localStorage` включает `agentId` из `useCurrentAgent()`. Колонка «ФИО» не скрывается (`enableHiding: false`). Неизвестная колонка в хранилище игнорируется.
10. **Колонка «Продуктов»** скрыта по умолчанию (п. 4.1).
11. **Формат даты.** `registeredAt` (UTC) форматируется `dayjs` в локальном часовом поясе браузера: `DD.MM.YYYY`. Мок-бэкенд отдаёт 06–17 UTC, поэтому дата совпадает с МСК.
12. **Ошибка догрузки и «Повторить».** `fetchNextPage` повторяет только догрузку. Кнопка появляется при `isFetchNextPageError`. Загруженные строки остаются.
13. **403.** Состояние «Нет доступа» — показывается вместо таблицы, фильтры недоступны. Отличаем от 5xx через `isHttpError(error, 403)`.
14. **Пустой список.** «Пусто, без фильтров» — `total === 0` и ни одного фильтра. «Пусто, с фильтрами» — `total === 0` и заданы фильтры (`q`, `status`, `from`, `to`). Сортировка фильтром не считается.
15. **Пагинация.** `limit=50`. Следующая порция — когда последняя видимая строка находится в пределах 10 строк от конца загруженных. Условие: `hasNextPage && !isFetchingNextPage`.
16. **Virtualization.** `estimateSize` = фиксированная высота строки (48 px), `overscan: 10`. DOM ≤ 60 строк (AC-15).
17. **Клавиатура.** `Enter` на строке в фокусе → `navigate({ to: "/clients/$clientId", params })`. Строка: `tabIndex=0`, `role="row"`, `onKeyDown`. Клик тоже открывает карточку.
18. **Статус.** Текст + цветной тег из токенов `status-*` через `theme.useToken()`.
19. **Сумма.** `formatMoney(commissionKopecks)`, правое выравнивание, `textAlign: "right"` в колонке.
20. **Ошибка парсинга ответа** (`ContractError`) → состояние ошибки (п. 3 таблица ошибок спеки).
21. **Вне рамок.** Карточка клиента — заглушка. Мобильные — не учитываем.

## 6. Соответствие AC и тестов

| AC | Что закрывает | Тест |
|---|---|---|
| AC-01 | `useClients`, `ClientsTable` (скелетон, total в заголовке, сортировка по умолчанию `registeredAt:desc`) | integration `ClientsPage.test.tsx`: скелетон, 50 строк, заголовок с total |
| AC-02 | `columns.tsx` (порядок, форматы, видимость по умолчанию) | integration: порядок заголовков, `Продуктов` скрыт |
| AC-03 | `formatMoney` в колонке комиссии | integration: значения `1 234 567,00 ₽`, `0,05 ₽`, `0,00 ₽` (моки-фикстуры `1234567`, `5`, `0`) |
| AC-04 | `ClientSearchInput` (debounce, min length, trim) | unit `search.test.ts` (параметры) + integration: `userEvent.type("Иванов")` → один запрос `q=Иванов` (через `requestLog` из `@/mocks`) |
| AC-05 | `clients-filters` (статус, период, сброс; сброс не трогает sort) | integration: смена статуса → `status=LEAD` в запросе; кнопка видна только с фильтрами |
| AC-06 | Сброс страницы при смене фильтров/сортировки (новый ключ, scroll restoration) | integration: смена фильтра → новый запрос без `cursor` |
| AC-07 | `nextSort`, `aria-sort`, иконка | unit `nextSort.test.ts` + integration: клик по заголовку → `sort=...` |
| AC-08 | `ClientsTable` (порог 10 строк) | e2e: прокрутка догружает страницы |
| AC-09 | Состояния `ClientsPage`/`ClientsTable` | integration: все состояния через `server.use` (сценарии `error-first-page`, `error-next-page`, `empty`, `forbidden`, `network-error`, `malformed` через `setMockScenario`) |
| AC-10 | `search.ts` (validateSearch) | unit: парсинг, мусор → дефолт; integration: открытие по ссылке с фильтрами |
| AC-11 | Кэш 60 с + scroll restoration | e2e: переход в карточку и «назад» |
| AC-12 | URL | e2e: `reload` сохраняет фильтры |
| AC-13 | `useColumnVisibility` + Zod-проверка `localStorage` | unit: чтение `localStorage`; integration: скрытие, «ФИО» нельзя скрыть, «По умолчанию», перемонтирование |
| AC-14 | `role="row"`, `Enter`, подписи полей, текст статуса | integration: `getByRole`, `keyboard("{Enter}")` |
| AC-15 | `useVirtualizer` + `overscan: 10` | e2e: после загрузки всех страниц в DOM ≤ 60 `role="row"` (в jsdom высота скролла нулевая, поэтому виртуализация проверяется только в Playwright) |

## 7. Порядок реализации

1. `entities/client`: `api.ts`, `queries.ts`, `useClients.ts`, `search.ts`, `index.ts`. Unit-тесты `search.test.ts`, `nextSort.test.ts`.
2. `app/router.tsx`: `validateSearch`, `scrollRestoration`, `scrollToTopSelectors`, `getScrollRestorationKey`.
3. `widgets/clients-table` и `features/clients-columns`, `features/clients-sort`.
4. `features/clients-filters`.
5. `pages/clients/ClientsPage.tsx`.
6. Интеграционные тесты `widgets/clients-table/ClientsTable.test.tsx`, `pages/clients/ClientsPage.test.tsx`.
7. `e2e/clients.spec.ts`.
8. `npm run check`, `npm run test:e2e`.

## 8. Фактическое покрытие

- Unit (Vitest): `src/entities/client/search.test.ts` (AC-10: разбор и нормализация адреса, мусор на входе), `src/features/clients-sort/nextSort.test.ts` (AC-07), `src/features/clients-columns/useColumnVisibility.test.ts` (AC-13: `localStorage`, повреждённые данные, колонка «ФИО»).
- Интеграция (Vitest + Testing Library + MSW): `src/pages/clients/ClientsPage.test.tsx`. Покрывает AC-01, AC-02, AC-03, AC-05, AC-06, AC-07, AC-09 (все состояния, включая 403 и ошибку первой порции с «Повторить»), AC-10, AC-13, AC-14 (Enter открывает карточку).
- Виртуализатор в jsdom получает высоту скролл-контейнера через мок `clientHeight` в тесте, без правок `src/test/**`.
- E2E (Playwright): `e2e/clients.spec.ts`. Покрывает AC-04 (один запрос при посимвольном вводе), AC-08 (догрузка при прокрутке), AC-11 (карточка и «Назад» без запроса, строка в зоне видимости), AC-12 (перезагрузка), AC-10 (ссылка с параметрами), AC-15 (не больше 60 строк в DOM).
- `npm run check` и `npm run test:e2e` проходят. Защищённые файлы не изменены.
