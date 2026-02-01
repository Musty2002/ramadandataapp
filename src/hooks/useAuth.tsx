import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Profile, Wallet } from '@/types/database';
import { withTimeout } from '@/lib/supabaseWithTimeout';

const AUTH_CACHE_KEY = 'auth_cache_v1';

type AuthCache = {
  profile: Profile | null;
  wallet: Wallet | null;
  cachedAt: string;
};

function readAuthCache(): AuthCache | null {
  try {
    const raw = localStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthCache;
  } catch {
    return null;
  }
}

function writeAuthCache(next: AuthCache) {
  try {
    localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage failures
  }
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  wallet: Wallet | null;
  loading: boolean;
  dataLoading: boolean;
  dataError: string | null;
  signUp: (email: string, password: string, fullName: string, phone: string, referralCode?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshWallet: () => Promise<void>;
  retryDataFetch: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const FETCH_TIMEOUT = 15000; // 15 seconds - mobile networks + background resume can be slow

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // Hydrate from local cache ASAP so the UI stays stable after Android background reloads
  useEffect(() => {
    const cached = readAuthCache();
    if (cached?.profile) setProfile(cached.profile);
    if (cached?.wallet) setWallet(cached.wallet);
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const queryPromise = supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      const { data } = await withTimeout(queryPromise, FETCH_TIMEOUT, 'Profile fetch timed out');
      
      if (data) {
        const nextProfile = data as Profile;
        setProfile(nextProfile);
        writeAuthCache({
          profile: nextProfile,
          wallet,
          cachedAt: new Date().toISOString(),
        });
      }
      return data;
    } catch (error) {
      console.error('[Auth] Profile fetch error:', error);
      throw error;
    }
  }, [wallet]);

  const fetchWallet = useCallback(async (userId: string) => {
    try {
      const queryPromise = supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      const { data } = await withTimeout(queryPromise, FETCH_TIMEOUT, 'Wallet fetch timed out');

      if (data) {
        const row = data as any;
        const parsedBalance = Number(row.balance);
        const nextWallet: Wallet = {
          ...(row as Wallet),
          balance: Number.isFinite(parsedBalance) ? parsedBalance : 0,
        };
        setWallet(nextWallet);
        writeAuthCache({
          profile,
          wallet: nextWallet,
          cachedAt: new Date().toISOString(),
        });
      }
      return data;
    } catch (error) {
      console.error('[Auth] Wallet fetch error:', error);
      throw error;
    }
  }, [profile]);

  const fetchUserData = useCallback(async (userId: string) => {
    // If we already have cached data, refresh silently in the background.
    // This prevents “connection failed” UI taking over when resuming offline.
    const hasCachedData = !!profile || !!wallet;
    setDataLoading(!hasCachedData);
    if (!hasCachedData) setDataError(null);
    
    try {
      await Promise.all([
        fetchProfile(userId),
        fetchWallet(userId),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load data';
      console.error('[Auth] Data fetch failed:', message);
      if (!hasCachedData) {
        setDataError(message);
      }
    } finally {
      setDataLoading(false);
    }
  }, [fetchProfile, fetchWallet, profile, wallet]);

  const retryDataFetch = useCallback(() => {
    if (user?.id) {
      fetchUserData(user.id);
    }
  }, [user?.id, fetchUserData]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer Supabase calls with setTimeout
        if (session?.user) {
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setWallet(null);
          setDataError(null);
        }
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchUserData]);

  const signUp = async (email: string, password: string, fullName: string, phone: string, referralCode?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          phone: phone,
          referral_code: referralCode || null,
        }
      }
    });
    
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setWallet(null);
    try {
      localStorage.removeItem(AUTH_CACHE_KEY);
    } catch {
      // ignore
    }
  };

  const refreshProfile = async () => {
    if (user) {
      try {
        await fetchProfile(user.id);
      } catch (error) {
        console.error('[Auth] Refresh profile failed:', error);
      }
    }
  };

  const refreshWallet = async () => {
    if (user) {
      try {
        await fetchWallet(user.id);
      } catch (error) {
        console.error('[Auth] Refresh wallet failed:', error);
      }
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      wallet,
      loading,
      dataLoading,
      dataError,
      signUp,
      signIn,
      signOut,
      refreshProfile,
      refreshWallet,
      retryDataFetch,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}