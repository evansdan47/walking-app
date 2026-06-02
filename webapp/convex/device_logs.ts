import { v } from "convex/values";
import { mutation } from "./_generated/server";

const MAX_STACK_CHARS = 800;
const MAX_ENTRIES = 200;

/**
 * Accepts a batch of diagnostic log entries from a device and stores them
 * centrally so they can be reviewed per-user / per-device from the dashboard.
 *
 * Called manually by the user via the "Send Logs" button in the Stats & State
 * debug panel. Entries are capped and stack traces truncated before insertion
 * to stay comfortably below Convex's 1 MB document limit.
 */
export const submit = mutation({
  args: {
    deviceId: v.string(),
    appVersion: v.string(),
    entries: v.array(
      v.object({
        ts: v.number(),
        level: v.string(),
        tag: v.string(),
        message: v.string(),
        stack: v.optional(v.string()),
        context: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    // Defensive cap — client should already limit to MAX_ENTRIES but enforce
    // server-side too so schema stays safe.
    const entries = args.entries.slice(0, MAX_ENTRIES).map((e) => ({
      ...e,
      stack: e.stack ? e.stack.slice(0, MAX_STACK_CHARS) : undefined,
      context: e.context ? e.context.slice(0, 400) : undefined,
    }));

    await ctx.db.insert("deviceLogs", {
      userId: identity?.tokenIdentifier ?? undefined,
      deviceId: args.deviceId,
      appVersion: args.appVersion,
      submittedAt: Date.now(),
      entries,
    });
  },
});
