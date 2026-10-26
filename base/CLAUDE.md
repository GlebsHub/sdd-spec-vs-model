# Агентский кабинет: правила работы

## Задача

Спецификация задачи — `SPEC.md` в корне проекта. Правила разработки — `conventions.md`.

## Порядок работы

Порядок обязателен, шаги выполняются по очереди.

1. Прочитай `SPEC.md`, `conventions.md` и существующий код в `src/`.
2. Напиши `PLAN.md` в корне проекта:
   - какие файлы появятся и в каких слоях;
   - где хранится каждое состояние: URL, кэш запросов, Zustand, `localStorage`;
   - для каждого критерия приёмки (AC) из `SPEC.md` — какая часть плана его закрывает. Если в спеке нет критериев, перечисли требования своими словами и сопоставь их так же.
3. Если спека допускает разные трактовки, запиши это в `PLAN.md` в раздел «Вопросы к спеке»: вопрос и принятое допущение. Не останавливайся и не жди ответа: работай дальше по допущению.
4. Реализуй по плану.

`PLAN.md` не удаляй: он входит в результат работы.

## Что уже есть

| Путь | Что это |
|---|---|
| `src/app/` | Провайдеры (тема AntD, QueryClient, роутер), дерево маршрутов `router.tsx`, `Layout` |
| `src/pages/clients/` | Заглушка страницы `/clients` |
| `src/pages/client-card/` | Заглушка карточки `/clients/$clientId` с кнопкой «Назад» |
| `src/shared/api/` | HTTP-клиент `http.get` с проверкой ответа схемой; ошибки `HttpError`, `NetworkError`, `ContractError`; `createQueryClient`; контракт `GET /api/agent/clients` в `clients/` (схемы, типы, `clientKeys`) |
| `src/shared/lib/money/` | `formatMoney` |
| `src/shared/lib/session/` | `useCurrentAgent()` — текущий агент сессии |
| `src/shared/ui/` | Тема Ant Design, в том числе токены статусов |
| `src/mocks/` | Мок-бэкенд на MSW: 10 000 клиентов, фильтры, поиск, сортировка, курсорная пагинация. Работает в dev и в тестах |
| `src/test/` | Настройка Vitest (MSW, полифилы jsdom) и `renderApp({ url, agentId })` — рендер приложения по адресу |
| `e2e/` | Playwright-тесты. Dev-сервер стартует автоматически |

Все нужные зависимости установлены. Добавлять новые **нельзя**.

В jsdom нет раскладки: размеры элементов там нулевые.

## Защищённые файлы

Изменение, удаление или переименование этих файлов считается провалом задачи, даже если проверки проходят:

- `SPEC.md`, `CLAUDE.md`, `conventions.md`
- `package.json`, `package-lock.json`
- `tsconfig.json`, `eslint.config.js`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`
- `public/mockServiceWorker.js`
- `src/main.tsx`, `src/mocks/**`, `src/test/**`
- `src/shared/api/clients/**`, `src/shared/api/http.ts`, `src/shared/api/errors.ts`
- `src/shared/lib/money/**`, `src/shared/lib/session/**`
- `e2e/smoke.spec.ts`

Новые файлы в `src/` и `e2e/` создавать можно.

<!-- contour:start -->
## Проверки и критерий готовности

Последний шаг порядка работы: прогони `npm run check` и `npm run test:e2e` и исправляй код, пока обе команды не пройдут.

| Команда | Что делает |
|---|---|
| `npm run check` | `tsc --noEmit`, ESLint с `--max-warnings 0`, Vitest |
| `npm run test:e2e` | Playwright |
| `npm run test:watch` | Vitest в watch-режиме |

Задача готова, только когда `npm run check` и `npm run test:e2e` проходят без ошибок и предупреждений.
<!-- contour:end -->
