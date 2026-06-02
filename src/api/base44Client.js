import { createClient } from "@base44/sdk";
import { isBase44Enabled } from "@/config/base44Flags";
import { appParams } from "@/lib/app-params";

const { appId, token, functionsVersion, appBaseUrl } = appParams;

export { isBase44Enabled } from "@/config/base44Flags";

/** null when local-first — createClient is not invoked (no User/me or other SDK calls) */
export const base44 = isBase44Enabled()
  ? createClient({
      appId,
      token,
      functionsVersion,
      serverUrl: "",
      requiresAuth: false,
      appBaseUrl,
    })
  : null;
