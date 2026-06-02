import { v } from "convex/values";
import { mutation } from "./_generated/server";

/**
 * Registers interest in the closed beta / open beta launch.
 * Unauthenticated — callable from the public waitlist page.
 * Duplicate emails are rejected to prevent double-submissions.
 */
export const register = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    walkingFrequency: v.optional(v.string()),
    walkingTypes: v.optional(v.array(v.string())),
    appsUsed: v.optional(v.array(v.string())),
    mainUses: v.optional(v.array(v.string())),
    frustrations: v.optional(v.array(v.string())),
    testingInterest: v.optional(v.string()),
    deviceTypes: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();

    if (!email || !args.name.trim()) {
      throw new Error("Name and email are required.");
    }

    // Basic email shape check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Please enter a valid email address.");
    }

    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (existing) {
      throw new Error("This email is already on the waitlist.");
    }

    await ctx.db.insert("waitlist", {
      name: args.name.trim(),
      email,
      walkingFrequency: args.walkingFrequency,
      walkingTypes: args.walkingTypes,
      appsUsed: args.appsUsed,
      mainUses: args.mainUses,
      frustrations: args.frustrations,
      testingInterest: args.testingInterest,
      deviceTypes: args.deviceTypes,
      submittedAt: Date.now(),
    });
  },
});
