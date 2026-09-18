import { action } from "./_generated/server.js";
import { internal } from "./_generated/api.js";

export const requestRefresh = action({
  args: {},
  handler: async (ctx): Promise<unknown> => await ctx.runAction(internal.syncActions.refreshCatalog, {}),
});
