// Mock Supabase client to completely remove the auth and database dependency.
// This allows the app to function locally without breaking existing component code.

export function createClient() {
  const mockChain = {
    select: () => mockChain,
    eq: () => mockChain,
    order: () => mockChain,
    limit: () => mockChain,
    single: async () => ({ data: null, error: null }),
    maybeSingle: async () => ({ data: null, error: null }),
    update: () => mockChain,
    insert: () => mockChain,
    upsert: async () => ({ error: null }),
    delete: () => mockChain,
    then: (cb: any) => cb({ data: null, error: null }),
  };

  return {
    auth: {
      getUser: async () => ({ data: { user: null } }),
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: async () => {},
      signUp: async () => ({ error: { message: "Auth is disabled" } }),
      signInWithPassword: async () => ({ error: { message: "Auth is disabled" } }),
      resetPasswordForEmail: async () => ({ error: { message: "Auth is disabled" } }),
    },
    from: () => mockChain,
  };
}
