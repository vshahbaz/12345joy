import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';
import type { DbProfile, DbOrganization, UserRole, AdminUser, AdminSession } from '@/types/database';

const ROLE_STORAGE_KEY = 'joy_dealer_user_role';
const ADMIN_SESSION_KEY = 'joy_dealer_admin_session';
const ADMIN_USER_KEY = 'joy_dealer_admin_user';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

interface SignUpVolunteerParams {
  email: string;
  password: string;
  fullName: string;
  city?: string;
  phone?: string;
}

interface SignUpOrgParams {
  email: string;
  password: string;
  orgName: string;
  contactName: string;
  phone?: string;
  city?: string;
  state?: string;
  website?: string;
  description?: string;
}

interface SignInParams {
  email: string;
  password: string;
  loginType?: 'volunteer' | 'organization';
}

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [profile, setProfile] = useState<DbProfile | null>(null);
  const [organization, setOrganization] = useState<DbOrganization | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [adminSessionToken, setAdminSessionToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  const sessionRef = useRef(session);
  sessionRef.current = session;
  const adminSessionTokenRef = useRef(adminSessionToken);
  adminSessionTokenRef.current = adminSessionToken;
  const userRef = useRef(user);
  userRef.current = user;

  const fetchProfile = useCallback(async (userId: string) => {
    console.log('[Auth] Fetching profile for user:', userId);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.log('[Auth] No profile found:', error.message);
      return null;
    }
    console.log('[Auth] Profile loaded:', data?.full_name);
    return data as DbProfile;
  }, []);

  const fetchOrganization = useCallback(async (adminOrgId: string) => {
    console.log('[Auth] Fetching organization by id:', adminOrgId);
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', adminOrgId)
      .single();

    if (error) {
      console.log('[Auth] No organization found:', error.message);
      return null;
    }
    console.log('[Auth] Organization loaded:', data?.name);
    return data as DbOrganization;
  }, []);

  const fetchOrganizationByAdminId = useCallback(async (adminOrgId: string) => {
    console.log('[Auth] Fetching organization by org ID for admin:', adminOrgId);
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', adminOrgId)
      .single();

    if (error) {
      console.log('[Auth] No organization found by admin org_id:', error.message);
      return null;
    }
    console.log('[Auth] Organization loaded for admin:', data?.name);
    return data as DbOrganization;
  }, []);

  const loadUserData = useCallback(async (currentUser: User) => {
    const storedRole = await AsyncStorage.getItem(ROLE_STORAGE_KEY);
    console.log('[Auth] Stored role:', storedRole);

    const profileData = await fetchProfile(currentUser.id);
    const orgData = await fetchOrganization(currentUser.id);

    if (profileData) setProfile(profileData);
    if (orgData) setOrganization(orgData);

    if (storedRole === 'volunteer' || storedRole === 'organization') {
      setRole(storedRole);
    } else if (orgData) {
      setRole('organization');
      await AsyncStorage.setItem(ROLE_STORAGE_KEY, 'organization');
    } else if (profileData) {
      setRole('volunteer');
      await AsyncStorage.setItem(ROLE_STORAGE_KEY, 'volunteer');
    }
  }, [fetchProfile, fetchOrganization]);

  const loadAdminSession = useCallback(async () => {
    console.log('[Auth] Checking for stored admin session');
    try {
      const [storedToken, storedAdminJson, storedRole] = await Promise.all([
        AsyncStorage.getItem(ADMIN_SESSION_KEY),
        AsyncStorage.getItem(ADMIN_USER_KEY),
        AsyncStorage.getItem(ROLE_STORAGE_KEY),
      ]);

      if (storedToken && storedAdminJson && storedRole === 'organization') {
        const storedAdmin = JSON.parse(storedAdminJson) as AdminUser;
        console.log('[Auth] Found stored admin session for:', storedAdmin.email);

        setAdminUser(storedAdmin);
        setAdminSessionToken(storedToken);
        setRole('organization');

        if (storedAdmin.organization_id) {
          const orgData = await fetchOrganizationByAdminId(storedAdmin.organization_id);
          if (orgData) setOrganization(orgData);
        }

        return true;
      }
    } catch (err) {
      console.error('[Auth] Error loading admin session:', err);
    }
    return false;
  }, [fetchOrganizationByAdminId]);

  const authAdminUserRef = useRef(adminUser);
  useEffect(() => {
    authAdminUserRef.current = adminUser;
  }, [adminUser]);

  useEffect(() => {
    console.log('[Auth] Initializing auth state');
    let mounted = true;

    const initAuth = async () => {
      try {
        const adminLoaded = await loadAdminSession();

        if (adminLoaded && mounted) {
          console.log('[Auth] Admin session restored');
          setIsLoading(false);
          setIsInitialized(true);
          return;
        }

        const { data: { session: currentSession } } = await supabase.auth.getSession();
        console.log('[Auth] Initial session:', currentSession ? 'found' : 'none');

        if (mounted && currentSession?.user) {
          setSession(currentSession);
          setUser(currentSession.user);
          await loadUserData(currentSession.user);
        }
      } catch (error) {
        console.error('[Auth] Init error:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
          setIsInitialized(true);
        }
      }
    };

    void initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        console.log('[Auth] Auth state changed:', _event);
        if (!mounted) return;

        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          await loadUserData(newSession.user);
        } else if (!authAdminUserRef.current) {
          setProfile(null);
          setOrganization(null);
          setRole(null);
          await AsyncStorage.removeItem(ROLE_STORAGE_KEY);
        }
        setIsLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserData, loadAdminSession]);

  const signUpVolunteerMutation = useMutation({
    mutationFn: async (params: SignUpVolunteerParams) => {
      console.log('[Auth] Signing up volunteer:', params.email);
      const { data, error } = await supabase.auth.signUp({
        email: params.email,
        password: params.password,
        options: {
          data: {
            full_name: params.fullName,
            role: 'volunteer',
          },
        },
      });

      if (error) throw error;
      if (!data.user) throw new Error('Sign up failed — no user returned');

      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: params.fullName,
        email: params.email,
        phone: params.phone ?? null,
        city: params.city ?? null,
        total_points: 0,
        total_hours: 0,
        redeemed_points: 0,
        is_verified: false,
      });

      if (profileError) {
        console.error('[Auth] Profile creation error:', profileError);
      }

      await AsyncStorage.setItem(ROLE_STORAGE_KEY, 'volunteer');
      setRole('volunteer');
      return data;
    },
  });

  const signUpOrgMutation = useMutation({
    mutationFn: async (params: SignUpOrgParams) => {
      console.log('[Auth] Signing up organization:', params.orgName);
      const { data, error } = await supabase.auth.signUp({
        email: params.email,
        password: params.password,
        options: {
          data: {
            full_name: params.contactName,
            role: 'organization',
            org_name: params.orgName,
          },
        },
      });

      if (error) throw error;
      if (!data.user) throw new Error('Sign up failed — no user returned');

      const { error: orgError } = await supabase.from('organizations').insert({
        name: params.orgName,
        contact_email: params.email,
        contact_phone: params.phone ?? null,
        city: params.city ?? null,
        state: params.state ?? null,
        website: params.website ?? null,
        description: params.description ?? null,
        is_verified: false,
        is_active: true,
      });

      if (orgError) {
        console.error('[Auth] Organization creation error:', orgError);
      }

      await AsyncStorage.setItem(ROLE_STORAGE_KEY, 'organization');
      setRole('organization');
      return data;
    },
  });

  const adminAuthLogin = useCallback(async (email: string, password: string): Promise<AdminSession> => {
    console.log('[Auth] Attempting admin-auth Edge Function login for:', email);
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/admin-auth`;
    console.log('[Auth] Edge Function URL:', edgeFunctionUrl);

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''}`,
      },
      body: JSON.stringify({
        action: 'login',
        email: email.toLowerCase().trim(),
        password,
      }),
    });

    console.log('[Auth] Admin auth response status:', response.status);

    const responseText = await response.text();
    console.log('[Auth] Admin auth response body:', responseText.substring(0, 500));

    let result: Record<string, unknown>;
    try {
      result = JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      console.error('[Auth] Failed to parse admin auth response');
      throw new Error('Invalid response from authentication server. Please try again.');
    }

    if (!response.ok) {
      const errorMsg = (result.error as string) ?? (result.message as string) ?? 'Authentication failed';
      console.error('[Auth] Admin auth error:', errorMsg);
      throw new Error(errorMsg);
    }

    const adminSession = result as unknown as AdminSession;

    if (!adminSession.session_token || !adminSession.admin_user) {
      const token = (result.token ?? result.session_token ?? result.sessionToken) as string | undefined;
      const adminData = (result.user ?? result.admin_user ?? result.adminUser ?? result.admin) as AdminUser | undefined;

      if (token && adminData) {
        return {
          session_token: token,
          admin_user: adminData,
          expires_at: (result.expires_at ?? result.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()) as string,
        };
      }

      console.error('[Auth] Admin auth response missing expected fields:', Object.keys(result));
      throw new Error('Authentication succeeded but response format was unexpected. Please contact support.');
    }

    return adminSession;
  }, []);

  const signInMutation = useMutation({
    mutationFn: async (params: SignInParams) => {
      console.log('[Auth] Signing in with:', params.email, 'loginType:', params.loginType);

      if (params.loginType === 'organization') {
        console.log('[Auth] Using admin-auth Edge Function for organization login');
        try {
          const adminSession = await adminAuthLogin(params.email, params.password);

          console.log('[Auth] Admin login successful:', adminSession.admin_user.email, 'name:', adminSession.admin_user.name);

          await AsyncStorage.setItem(ADMIN_SESSION_KEY, adminSession.session_token);
          await AsyncStorage.setItem(ADMIN_USER_KEY, JSON.stringify(adminSession.admin_user));
          await AsyncStorage.setItem(ROLE_STORAGE_KEY, 'organization');

          setAdminUser(adminSession.admin_user);
          setAdminSessionToken(adminSession.session_token);
          setRole('organization');

          if (adminSession.admin_user.organization_id) {
            const orgData = await fetchOrganizationByAdminId(adminSession.admin_user.organization_id);
            if (orgData) {
              console.log('[Auth] Loaded organization for admin:', orgData.name);
              setOrganization(orgData);
            }
          }

          return { session: null, user: null, adminSession };
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : 'Organization login failed';
          console.error('[Auth] Admin auth failed:', errMsg);

          console.log('[Auth] Falling back to Supabase Auth for organization...');
          try {
            const fallbackResult = await volunteerStyleSignIn(params.email, params.password, 'organization');
            return fallbackResult;
          } catch (fallbackErr: unknown) {
            console.error('[Auth] Supabase fallback also failed:', fallbackErr instanceof Error ? fallbackErr.message : fallbackErr);
            throw new Error(errMsg);
          }
        }
      }

      return volunteerStyleSignIn(params.email, params.password, params.loginType);
    },
  });

  const resolveEmail = useCallback(async (input: string, _loginType?: 'volunteer' | 'organization'): Promise<string> => {
    const isEmail = input.includes('@');
    if (isEmail) {
      console.log('[Auth] Input is an email, will try direct auth first');
      return input;
    }

    console.log('[Auth] Input looks like a username/org name, resolving for:', input);

    const { data: profileData } = await supabase
      .from('profiles')
      .select('email')
      .eq('username', input)
      .single();

    if (profileData?.email) {
      console.log('[Auth] Resolved username to email:', profileData.email);
      return profileData.email;
    }

    console.log('[Auth] No profile match, checking organizations by name');
    const { data: orgData } = await supabase
      .from('organizations')
      .select('contact_email')
      .ilike('name', input)
      .single();

    if (orgData?.contact_email) {
      console.log('[Auth] Resolved org name to contact_email:', orgData.contact_email);
      return orgData.contact_email;
    }

    throw new Error('No account found with that username or organization name. Please check and try again.');
  }, []);

  const volunteerStyleSignIn = useCallback(async (emailInput: string, password: string, loginType?: 'volunteer' | 'organization') => {
    console.log('[Auth] Volunteer-style sign in for:', emailInput);
    const resolvedEmail = await resolveEmail(emailInput, loginType);
    console.log('[Auth] Resolved email:', resolvedEmail);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: resolvedEmail,
      password,
    });

    if (!error && data?.session) {
      console.log('[Auth] Sign in succeeded for:', resolvedEmail);
      if (loginType) {
        await AsyncStorage.setItem(ROLE_STORAGE_KEY, loginType);
        setRole(loginType);
      }
      return data;
    }

    if (error && error.message === 'Invalid login credentials') {
      const lowerEmail = resolvedEmail.toLowerCase().trim();
      if (lowerEmail !== resolvedEmail) {
        const lowerAttempt = await supabase.auth.signInWithPassword({ email: lowerEmail, password });
        if (!lowerAttempt.error && lowerAttempt.data?.session) {
          console.log('[Auth] Lowercase email auth succeeded');
          if (loginType) {
            await AsyncStorage.setItem(ROLE_STORAGE_KEY, loginType);
            setRole(loginType);
          }
          return lowerAttempt.data;
        }
      }
    }

    if (error) {
      if (error.message === 'Invalid login credentials') {
        throw new Error('Invalid email or password. Please check your credentials and try again.');
      }
      if (error.message === 'Email not confirmed') {
        throw new Error('Your email has not been confirmed yet. Please check your inbox for a confirmation link.');
      }
      throw new Error(error.message || 'An unknown authentication error occurred.');
    }

    throw new Error('Sign in succeeded but no session was created. Please try again.');
  }, [resolveEmail]);

  const signOutFn = useCallback(async () => {
    console.log('[Auth] Signing out');

    if (adminSessionTokenRef.current) {
      console.log('[Auth] Clearing admin session');
      await AsyncStorage.removeItem(ADMIN_SESSION_KEY);
      await AsyncStorage.removeItem(ADMIN_USER_KEY);
      setAdminUser(null);
      setAdminSessionToken(null);
    }

    if (sessionRef.current) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('[Auth] Supabase sign out error:', error.message);
      }
    }

    setSession(null);
    setUser(null);
    setProfile(null);
    setOrganization(null);
    setRole(null);
    await AsyncStorage.removeItem(ROLE_STORAGE_KEY);
    console.log('[Auth] Sign out complete');
  }, []);

  const signOutMutation = useMutation({
    mutationFn: signOutFn,
  });

  const isAuthenticated = useMemo(() => {
    return !!session?.user || !!adminSessionToken;
  }, [session, adminSessionToken]);

  const adminUserRef = useRef(adminUser);
  adminUserRef.current = adminUser;

  const refreshProfile = useCallback(async () => {
    console.log('[Auth] Refreshing profile data');
    const currentUser = userRef.current;
    const currentAdminUser = adminUserRef.current;
    if (currentUser) {
      const profileData = await fetchProfile(currentUser.id);
      if (profileData) setProfile(profileData);
      const orgData = await fetchOrganization(currentUser.id);
      if (orgData) setOrganization(orgData);
    } else if (currentAdminUser?.organization_id) {
      const orgData = await fetchOrganizationByAdminId(currentAdminUser.organization_id);
      if (orgData) setOrganization(orgData);
    }
  }, [fetchProfile, fetchOrganization, fetchOrganizationByAdminId]);

  const signUpVolunteerRef = useRef(signUpVolunteerMutation.mutateAsync);
  signUpVolunteerRef.current = signUpVolunteerMutation.mutateAsync;
  const signUpVolunteer = useCallback(async (params: SignUpVolunteerParams) => {
    return signUpVolunteerRef.current(params);
  }, []);

  const signUpOrgRef = useRef(signUpOrgMutation.mutateAsync);
  signUpOrgRef.current = signUpOrgMutation.mutateAsync;
  const signUpOrg = useCallback(async (params: SignUpOrgParams) => {
    return signUpOrgRef.current(params);
  }, []);

  const signInRef = useRef(signInMutation.mutateAsync);
  signInRef.current = signInMutation.mutateAsync;
  const signIn = useCallback(async (params: SignInParams) => {
    return signInRef.current(params);
  }, []);

  const signOutRef = useRef(signOutMutation.mutateAsync);
  signOutRef.current = signOutMutation.mutateAsync;
  const signOut = useCallback(async () => {
    return signOutRef.current();
  }, []);

  const isSigningIn = signInMutation.isPending;
  const isSigningUp = signUpVolunteerMutation.isPending || signUpOrgMutation.isPending;
  const isSigningOut = signOutMutation.isPending;
  const authError = signInMutation.error ?? signUpVolunteerMutation.error ?? signUpOrgMutation.error ?? null;

  return useMemo(() => ({
    session,
    user,
    role,
    profile,
    organization,
    adminUser,
    adminSessionToken,
    isLoading,
    isInitialized,
    isAuthenticated,
    signUpVolunteer,
    signUpOrg,
    signIn,
    signOut,
    refreshProfile,
    isSigningIn,
    isSigningUp,
    isSigningOut,
    authError,
  }), [
    session, user, role, profile, organization, adminUser, adminSessionToken,
    isLoading, isInitialized, isAuthenticated,
    signUpVolunteer, signUpOrg, signIn, signOut, refreshProfile,
    isSigningIn, isSigningUp, isSigningOut, authError,
  ]);
});
