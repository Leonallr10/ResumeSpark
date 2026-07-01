// Mock Supabase client to completely remove the auth and database dependency.
// This allows the app to function locally without breaking existing component code.

export function createClient() {
  const mockChain = {
    select: (...args: any[]) => mockChain,
    eq: (...args: any[]) => mockChain,
    order: (...args: any[]) => mockChain,
    limit: (...args: any[]) => mockChain,
    single: async (...args: any[]) => ({ data: null, error: null }),
    maybeSingle: async (...args: any[]) => ({ data: null, error: null }),
    update: (...args: any[]) => mockChain,
    insert: (...args: any[]) => mockChain,
    upsert: async (...args: any[]) => ({ error: null }),
    delete: (...args: any[]) => mockChain,
    then: (cb: any) => cb({ data: null, error: null }),
  };

  return {
    auth: {
      getUser: async () => ({ data: { user: null } }),
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: async () => {},
      signUp: async (...args: any[]) => ({ error: { message: "Auth is disabled" } }),
      signInWithPassword: async (...args: any[]) => ({ error: { message: "Auth is disabled" } }),
      resetPasswordForEmail: async (...args: any[]) => ({ error: { message: "Auth is disabled" } }),
    },
    from: (...args: any[]) => mockChain,
  };
}
