import { Faker, base, en, ru } from "@faker-js/faker";
import { CLIENT_STATUS } from "@/shared/api";
import type { Client, ClientStatus } from "@/shared/api";

export const MOCK_SEED = 20261001;
export const MOCK_CLIENTS_COUNT = 10_000;
/** Фиксированная «текущая» дата генерации: данные не зависят от дня запуска. */
export const MOCK_REFERENCE_DATE = "2026-10-01T00:00:00.000Z";

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_DAYS = 3 * 365;
/**
 * Время регистрации только 06:00–17:59 UTC. Тогда календарная дата совпадает в UTC и МСК (UTC+3),
 * и фильтр по дате на бэкенде не расходится с датой в таблице.
 */
const FIRST_HOUR_UTC = 6;
const LAST_HOUR_UTC = 17;

const STATUS_WEIGHTS: { value: ClientStatus; weight: number }[] = [
  { value: CLIENT_STATUS.LEAD, weight: 35 },
  { value: CLIENT_STATUS.ACCOUNT_OPENED, weight: 25 },
  { value: CLIENT_STATUS.FUNDED, weight: 30 },
  { value: CLIENT_STATUS.INACTIVE, weight: 10 },
];

/** Каждый N-й клиент получает фамилию Иванов / Иванова, чтобы поиск «Иванов» гарантированно находил записи. */
const IVANOV_EVERY = 250;

const commissionFor = (faker: Faker, status: ClientStatus): number => {
  switch (status) {
    case CLIENT_STATUS.LEAD:
      return 0;
    case CLIENT_STATUS.ACCOUNT_OPENED:
      return faker.number.int({ min: 0, max: 50_000 });
    case CLIENT_STATUS.FUNDED:
      return faker.number.int({ min: 1_000, max: 5_000_000 });
    case CLIENT_STATUS.INACTIVE:
      return faker.number.int({ min: 0, max: 200_000 });
  }
};

const productsFor = (faker: Faker, status: ClientStatus): number => {
  switch (status) {
    case CLIENT_STATUS.LEAD:
      return 0;
    case CLIENT_STATUS.ACCOUNT_OPENED:
      return faker.number.int({ min: 1, max: 2 });
    case CLIENT_STATUS.FUNDED:
      return faker.number.int({ min: 1, max: 5 });
    case CLIENT_STATUS.INACTIVE:
      return faker.number.int({ min: 0, max: 3 });
  }
};

const registeredAtFor = (faker: Faker): string => {
  const reference = Date.parse(MOCK_REFERENCE_DATE);
  const daysAgo = faker.number.int({ min: 1, max: HISTORY_DAYS });
  const date = new Date(reference - daysAgo * DAY_MS);
  date.setUTCHours(
    faker.number.int({ min: FIRST_HOUR_UTC, max: LAST_HOUR_UTC }),
    faker.number.int({ min: 0, max: 59 }),
    faker.number.int({ min: 0, max: 59 }),
    0,
  );
  return date.toISOString();
};

const phoneFor = (faker: Faker): string =>
  `+7 *** ***-${faker.string.numeric(2)}-${faker.string.numeric(2)}`;

const createClient = (faker: Faker, index: number): Client => {
  const sex = faker.person.sexType();
  const lastName =
    index % IVANOV_EVERY === 0 ? (sex === "female" ? "Иванова" : "Иванов") : faker.person.lastName(sex);
  const status = faker.helpers.weightedArrayElement(STATUS_WEIGHTS);
  return {
    id: faker.string.uuid(),
    fullName: `${lastName} ${faker.person.firstName(sex)} ${faker.person.middleName(sex)}`,
    phoneMasked: phoneFor(faker),
    status,
    registeredAt: registeredAtFor(faker),
    commissionKopecks: commissionFor(faker, status),
    productsCount: productsFor(faker, status),
  };
};

/**
 * Детерминированный набор клиентов. Три самых новых клиента имеют контрольные суммы комиссии
 * из спецификации: 1234567, 5 и 0 копеек (по убыванию даты регистрации).
 */
export const createClientsDb = (seed = MOCK_SEED, count = MOCK_CLIENTS_COUNT): Client[] => {
  const faker = new Faker({ locale: [ru, en, base] });
  faker.seed(seed);
  const clients = Array.from({ length: count }, (_, index) => createClient(faker, index));

  const newestFirst = [...clients].sort((a, b) => b.registeredAt.localeCompare(a.registeredAt));
  const fixtures: Pick<Client, "status" | "commissionKopecks" | "productsCount">[] = [
    { status: CLIENT_STATUS.FUNDED, commissionKopecks: 1_234_567, productsCount: 3 },
    { status: CLIENT_STATUS.ACCOUNT_OPENED, commissionKopecks: 5, productsCount: 1 },
    { status: CLIENT_STATUS.LEAD, commissionKopecks: 0, productsCount: 0 },
  ];
  fixtures.forEach((fixture, position) => {
    const client = newestFirst[position];
    if (client) {
      Object.assign(client, fixture);
    }
  });
  return clients;
};

let clientsDb: Client[] | undefined;

/** Общий экземпляр базы: создаётся при первом обращении. */
export const getClientsDb = (): Client[] => {
  clientsDb ??= createClientsDb();
  return clientsDb;
};
