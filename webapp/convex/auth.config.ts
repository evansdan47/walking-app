export default {
  providers: [
    {
      // Clerk frontend API domain (decoded from EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY)
      domain: "https://mint-ray-85.clerk.accounts.dev",
      // Must match the 'aud' claim in the Clerk JWT template named "convex"
      applicationID: "convex",
    },
  ],
};
