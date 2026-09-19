import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { AppRouterClient } from "../../api";
import { readAdminKey } from "./admin-key";

const link = new RPCLink({
  url: `${window.location.origin}/api/rpc`,
  // Чтение открыто всем; запись сервер пропускает только с ключом методолога.
  headers: () => {
    const key = readAdminKey();
    return key ? { "x-admin-key": key } : {};
  },
});

/** Direct typed client: await client.ping() */
export const client: AppRouterClient = createORPCClient(link);

/** TanStack Query helpers: useQuery(orpc.ping.queryOptions()) */
export const orpc = createTanstackQueryUtils(client);
