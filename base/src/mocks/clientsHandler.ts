import { HttpResponse, delay, http } from "msw";
import type { JsonBodyType } from "msw";
import type { ClientListResponse } from "@/shared/api";
import { BadRequestError, parseClientsQuery, queryFingerprint, selectClients } from "./clientsQuery";
import { decodeCursor, encodeCursor } from "./cursor";
import { getClientsDb } from "./db";
import { logRequest } from "./requestLog";
import { MOCK_SCENARIO, getMockSettings, shouldFail } from "./scenarios";

export const CLIENTS_ENDPOINT = "/api/agent/clients";

const respond = (request: Request, body: JsonBodyType, status: number): Response => {
  logRequest(request, status);
  return HttpResponse.json(body, { status });
};

export const clientsHandler = http.get(CLIENTS_ENDPOINT, async ({ request }) => {
  const { scenario, delayMs } = getMockSettings();
  if (delayMs > 0) {
    await delay(delayMs);
  }

  const searchParams = new URL(request.url).searchParams;
  const isNextPage = searchParams.has("cursor");

  if (scenario === MOCK_SCENARIO.forbidden && shouldFail(true)) {
    return respond(request, { error: "forbidden" }, 403);
  }
  if (scenario === MOCK_SCENARIO.networkError && shouldFail(true)) {
    logRequest(request, 0);
    return HttpResponse.error();
  }
  if (
    (scenario === MOCK_SCENARIO.errorFirstPage && shouldFail(!isNextPage)) ||
    (scenario === MOCK_SCENARIO.errorNextPage && shouldFail(isNextPage))
  ) {
    return respond(request, { error: "internal" }, 500);
  }
  if (scenario === MOCK_SCENARIO.malformed && shouldFail(true)) {
    return respond(request, { items: [{ id: 1, fullName: null }], nextCursor: 0 }, 200);
  }

  try {
    const query = parseClientsQuery(searchParams);
    const fingerprint = queryFingerprint(query);
    const offset = query.cursor === undefined ? 0 : decodeCursor(query.cursor, fingerprint);
    const matched = scenario === MOCK_SCENARIO.empty ? [] : selectClients(getClientsDb(), query);
    const end = offset + query.limit;
    const body: ClientListResponse = {
      items: matched.slice(offset, end),
      nextCursor: end < matched.length ? encodeCursor({ offset: end, fingerprint }) : null,
      total: matched.length,
    };
    return respond(request, body, 200);
  } catch (error) {
    if (error instanceof BadRequestError) {
      return respond(request, { error: "bad_request", message: error.message }, 400);
    }
    throw error;
  }
});
