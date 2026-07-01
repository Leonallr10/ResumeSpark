// Mock Supabase client to completely remove the auth and database dependency.
// This allows the app to function locally without breaking existing component code.

export function createClient() {
  const mockChain = {
    select: (...args: unknown[]) => mockChain,
    eq: (...args: unknown[]) => mockChain,
    order: (...args: unknown[]) => mockChain,
    limit: (...args: unknown[]) => mockChain,
    single: async (...args: unknown[]) => ({ data: null, error: null }),
    maybeSingle: async (...args: unknown[]) => ({ data: null, error: null }),
    update: (...args: unknown[]) => mockChain,
    insert: (...args: unknown[]) => mockChain,
    upsert: async (...args: unknown[]) => ({ error: null }),
    delete: (...args: unknown[]) => mockChain,
    then: (cb: (value: unknown) => unknown) => cb({ data: null, error: null }),
  };

  return {
    auth: {
      getUser: async () => ({ data: { user: null } }),
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: async () => {},
      signUp: async (...args: unknown[]) => ({ error: { message: "Auth is disabled" } }),
      signInWithPassword: async (...args: unknown[]) => ({ error: { message: "Auth is disabled" } }),
      resetPasswordForEmail: async (...args: unknown[]) => ({ error: { message: "Auth is disabled" } }),
    },
    from: (...args: unknown[]) => mockChain,
  };
}
