import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, role?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function withTimeout<T>(operation: PromiseLike<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    Promise.resolve(operation).then(resolve, reject).finally(() => window.clearTimeout(timer));
  });
}

function validateHyperfeedsDomain(email: string): Error | null {
  const cleanEmail = (email || '').trim().toLowerCase();
  const isExactAdmin = cleanEmail === 'admin@hyperfeeds.com';
  const isOfficialDomain = cleanEmail.endsWith('@hyperfeeds.co.zw') || cleanEmail.endsWith('@hyperfeedsnutrition.co.zw');
  if (!isExactAdmin && !isOfficialDomain) {
    return new Error('Access restricted: Only official @hyperfeeds.co.zw email addresses or admin@hyperfeeds.com are allowed.');
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    withTimeout(supabase.auth.getSession(), 8000, 'Session check timed out.')
      .then(({ data: { session: s } }) => {
        if (!active) return;
        setSession(s);
        setUser(s?.user ?? null);
        if (!s?.user) setLoading(false);
      })
      .catch((error) => {
        if (!active) return;
        console.warn('Unable to restore the saved session:', error);
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (!s?.user) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    setLoading(true);
    // Read once per signed-in user, outside the auth callback's session lock.
    void (async () => {
      try {
        const { data, error } = await supabase.from('profiles').select('*')
          .eq('id', userId).abortSignal(controller.signal).maybeSingle();
        if (controller.signal.aborted) return;
        if (error) throw error;
        setProfile(data);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.warn('Unable to load the user profile:', error);
        setProfile(null);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [userId]);

  async function signIn(email: string, password: string) {
    const domainError = validateHyperfeedsDomain(email);
    if (domainError) return { error: domainError };

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  }

  async function signUp(email: string, password: string, fullName: string, role: string = 'operator') {
    const domainError = validateHyperfeedsDomain(email);
    if (domainError) return { error: domainError };

    const { data: authData, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
    });

    if (error) return { error: error as Error | null };

    if (authData?.user) {
      try {
        // Upsert profile with selected role
        await supabase.from('profiles').upsert([
          {
            id: authData.user.id,
            email: email.trim().toLowerCase(),
            full_name: fullName,
            role: role as any,
            updated_at: new Date().toISOString(),
          }
        ]);

        // Find role_id in roles table
        const { data: roleRow } = await supabase
          .from('roles')
          .select('id')
          .eq('code', role)
          .maybeSingle();

        if (roleRow?.id) {
          await supabase.from('user_roles').upsert([
            {
              user_id: authData.user.id,
              role_id: roleRow.id,
            }
          ]);
        }
      } catch (err) {
        console.warn('Failed to assign user role on signup:', err);
      }
    }

    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
