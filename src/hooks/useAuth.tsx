import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Profile, Wallet } from '@/types/database';
import { withTimeout } from '@/lib/supabaseWithTimeout';

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

const FETCH_TIMEOUT = 12000; // 12 seconds timeout for data fetches

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const queryPromise = supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      const { data } = await withTimeout(queryPromise, FETCH_TIMEOUT, 'Profile fetch timed out');
      
      if (data) {
        setProfile(data as Profile);
      }
      return data;
    } catch (error) {
      console.error('[Auth] Profile fetch error:', error);
      throw error;
    }
  }, []);

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
        setWallet({
          ...(row as Wallet),
          balance: Number.isFinite(parsedBalance) ? parsedBalance : 0,
        });
      }
      return data;
    } catch (error) {
      console.error('[Auth] Wallet fetch error:', error);
      throw error;
    }
  }, []);

  const fetchUserData = useCallback(async (userId: string) => {
    setDataLoading(true);
    setDataError(null);
    
    try {
      await Promise.all([
        fetchProfile(userId),
        fetchWallet(userId),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load data';
      console.error('[Auth] Data fetch failed:', message);
      setDataError(message);
    } finally {
      setDataLoading(false);
    }
  }, [fetchProfile, fetchWallet]);

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