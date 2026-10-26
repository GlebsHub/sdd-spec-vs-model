# План: раздел «Мои клиенты»

## Требования спецификации

В `SPEC.md` нумерованных критериев приёмки нет. Требования из текста спеки:

- **R1.** Список клиентов агента из `GET /api/agent/clients`, ответ проверяется схемой.
- **R2.** Колонки: ФИО, телефон, статус, дата регистрации, комиссия агента.
- **R3.** Поиск по ФИО.
- **R4.** Фильтр по статусу.
- **R5.** Фильтр по дате регистрации.
- **R6.** Сортировка.
- **R7.** Подгрузка страниц при прокрутке.
- **R8.** Клик по клиенту открывает карточку `/clients/$clientId`.
- **R9.** Агент настраивает, какие колонки видит.
- **R10.** Поведение из `conventions.md`: все состояния таблицы, восстановление при «назад», URL как источник истины для фильтров.

## Слои и файлы

Все новые файлы лежат в `src/` или `e2e/`. Защищённые файлы не трогаем: `src/shared/api/clients/**`, `src/shared/api/http.ts`, `src/shared/api/errors.ts`, `src/shared/lib/money/**`, `src/shared/lib/session/**`, `src/mocks/**`, `src/test/**`, `src/main.tsx`, `e2e/smoke.spec.ts`, конфиги.

| Слой | Файл | Назначение | Требования |
|---|---|---|---|
| `entities/client` | `listParams.ts` | Zod-схема параметров URL (`validateSearch`), значения по умолчанию, `toClientListParams` | R3–R6, R10 |
| `entities/client` | `status.ts` | Подписи статусов `CLIENT_STATUS_LABEL` | R2, R4 |
| `entities/client` | `api.ts` | `fetchClients` через `http.get` и `ClientListResponseSchema` | R1 |
| `entities/client` | `queries.ts` | `clientQueries.list` (`infiniteQueryOptions`), `staleTime` 5 мин | R1, R7, R10 |
| `entities/client` | `useClients.ts` | Хук чтения, возвращает предметные поля | R1, R7 |
| `entities/client` | `index.ts` | Публичный API | — |
| `shared/lib/date` | `formatMoscowDate.ts` | Дата `DD.MM.YYYY` в часовом поясе Москвы через `Intl` | R2 |
| `features/client-list-filters` | `ClientListFilters.tsx` | Поиск (debounce 300 мс, `replace`), статус (`Select`), период (`DatePicker.RangePicker`), «Сбросить» | R3–R5 |
| `features/client-columns-settings` | `ClientColumnsSettings.tsx` | Кнопка «Колонки» и `Popover` с чекбоксами | R9 |
| `widgets/clients-table` | `ClientsTable.tsx` | Панель фильтров, настройки колонок, таблица TanStack Table, виртуализация, все состояния | R1–R10 |
| `widgets/clients-table` | `columns.tsx` | Определения колонок, `id` = `CLIENT_COLUMN_ID` | R2, R6, R8 |
| `widgets/clients-table` | `useColumnVisibility.ts` | Видимость колонок в `localStorage` с Zod-проверкой | R9 |
| `widgets/clients-table` | `ClientsTable.module.css` | Сетка строк, скролл-контейнер | R7 |
| `widgets/clients-table` | `index.ts` | Публичный API | — |
| `pages/clients` | `ClientsPage.tsx` (изменяется) | Заголовок «Мои клиенты» и `ClientsTable` | R1 |
| `app` | `router.tsx` (изменяется) | `validateSearch` и `stripSearchParams` на `/clients`, `loader` с `prefetchInfiniteQuery`, `scrollRestoration` | R10 |

Тесты:

| Файл | Уровень |
|---|---|
| `entities/client/listParams.test.ts` | Unit: схема URL, мусор, значения по умолчанию, нормализация статусов, `toClientListParams` |
| `widgets/clients-table/useColumnVisibility.test.ts` | Unit: чтение `localStorage`, неизвестная колонка, битый JSON, недоступное хранилище |
| `shared/lib/date/formatMoscowDate.test.ts` | Unit: дата в МСК при любом `TZ` |
| `widgets/clients-table/ClientsTable.test.tsx` | Интеграция (Vitest + Testing Library + MSW): R1–R10 и состояния |
| `e2e/clients.spec.ts` | E2E (Playwright): R7, R10 (восстановление при «назад», ссылка с параметрами) |

Для расчёта `TZ`-независимости: в `vitest` тест `formatMoscowDate` сравнивает с ожидаемой строкой для момента 2026-10-01T21:30Z (это 2026-10-02 по МСК).

## Где хранится состояние

| Состояние | Где | Почему |
|---|---|---|
| Список клиентов (страницы) | TanStack Query, ключ `clientKeys.list(params)` | Серверные данные, кэш, `keepPreviousData` |
| Поиск, статус, период, сортировка | Параметры URL (`q`, `status`, `dateFrom`, `dateTo`, `sort`) | Ссылка, «назад», перезагрузка. Значения по умолчанию стираются через `stripSearchParams` |
| Текст поиска до debounce | `useState` в `ClientListFilters` | Локально. Синхронизируется с URL при изменении `q` |
| Видимость колонок | `localStorage`, ключ `agent-cabinet:clients-columns:v1:<agentId>`; в памяти `useState` | Настройка пользователя между сессиями, не в ссылке |
| Открыт ли `Popover` колонок | `useState` | Локально |
| Позиция прокрутки | Scroll restoration роутера, `data-scroll-restoration-id="clients-list"` | Конвенции, раздел 5.3 |
| Zustand | Не используется | Ничего не осталось для стора |

Ключ `scrollRestoration` делается уникальным для документа: префикс создаётся один раз при загрузке модуля. Это исключает восстановление после перезагрузки, которое ломает виртуализатор на пустом списке.

## Ключевые решения

- **Виртуализация.** `useVirtualizer` с `estimateSize: 56`, `overscan: 10`, `initialOffset` из `useElementScrollRestoration`. В jsdom раскладки нет, но виртуализатор рендерит `overscan` строк, поэтому интеграционные тесты видят первые строки.
- **Подгрузка.** `fetchNextPage` вызывается, когда последний видимый индекс ≥ `rows.length - 10`, при `hasNextPage && !isFetchingNextPage`.
- **Сортировка.** `manualSorting: true`, состояние сортировки берётся из URL, клик по заголовку пишет `sort=<field>:<dir>` в историю.
- **Кэш и «назад».** `staleTime: 5 мин` в `queries.ts`. `gcTime` клиента 10 мин. При возврате из карточки список берётся из кэша без запроса с первой страницы.
- **Ошибки.** Ошибка первой страницы показывает `Result` с «Повторить». Ошибка следующей страницы показывает `Alert` под таблицей с «Повторить» (`fetchNextPage`).
- **Даты.** `dateFrom`/`dateTo` — строки `YYYY-MM-DD` (календарная дата МСК, как в моке). Невалидная дата → значение по умолчанию.
- **Статусы в URL.** Строка через запятую (`status=LEAD,FUNDED`), в канонический порядок `CLIENT_STATUS`, неизвестные значения отбрасываются. Так URL короче JSON-массива.
- **Ссылка на карточку.** ФИО — `Link` на `/clients/$clientId`. `Link` даёт правильный «назад» и доступное имя.
- **Цвета статусов.** `Badge` с `color` из `theme.useToken()` (`colorStatus*`), без hex в компонентах.
- **Деньги.** `formatMoney(commissionKopecks)`.

## Вопросы к спеке и допущения

1. **Подписи и цвета статусов.** В `SPEC.md` нет текстов и цветов, а код ссылается на «спецификацию, п. 4.2», которой в репозитории нет. Допущение: «Лид» (LEAD, neutral), «Счёт открыт» (ACCOUNT_OPENED, info), «Пополнил» (FUNDED, success), «Неактивен» (INACTIVE, muted).
2. **Поиск короче двух символов.** Сервер отвечает 400. Допущение: `q` короче 2 символов после `trim` не отправляется, список показывается без поиска. В URL значение сохраняется.
3. **Период.** Допущение: `dateFrom` и `dateTo` включительны, сравниваются с календарной датой МСК. Если `dateFrom > dateTo`, значение уходит на сервер как есть.
4. **Настройка колонок.** Спека говорит только о видимости. Порядок и ширину не делаем. ФИО нельзя скрыть, его чекбокс заблокирован. Настройка хранится отдельно для каждого агента.
5. **Кнопка «Сбросить».** Допущение: очищает все параметры, включая сортировку, то есть возвращает URL к значениям по умолчанию.
6. **Телефон.** Сервер отдаёт маскированный номер. Показываем как есть.
7. **Идентификатор агента.** Эндпоинт не принимает агента, сессия определяется на сервере. Допущение: в запросе агент не передаётся. `useCurrentAgent` нужен только для ключа `localStorage`.
8. **Карточка клиента.** Это заглушка из `src/pages/client-card`. Допущение: раздел отвечает только за переход на неё.
9. **Сортировка по умолчанию.** Допущение: `registeredAt:desc`, как в моке `DEFAULT_SORT`.
10. **Доступные сортировки.** Допущение: сортируются ФИО, дата регистрации и комиссия. Телефон и статус не сортируются, потому что сервер отдаёт сортировку только по `CLIENT_SORT_FIELD`.

## Порядок реализации

1. `shared/lib/date`, `entities/client` (схема URL, API, запросы, хук), unit-тесты.
2. `features/*`, `widgets/clients-table`, `ClientsPage`.
3. `router.tsx`: `validateSearch`, `loader`, `scrollRestoration`.
4. Интеграционные тесты виджета.
5. E2E.
6. `npm run check`, `npm run build`, `npm run test:e2e`.
