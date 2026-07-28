import { requireSupabase, throwIfError } from "../lib/supabase.js";

export async function signIn(email, password) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  throwIfError(error);
  return data;
}

export async function signOut() {
  const { error } = await requireSupabase().auth.signOut();
  throwIfError(error);
}

export async function requestPasswordReset(email) {
  const redirectTo = `${import.meta.env.VITE_SITE_URL ?? window.location.origin}/#reset-password`;
  const { error } = await requireSupabase().auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  throwIfError(error);
}

export async function getCurrentSession() {
  const client = requireSupabase();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  throwIfError(sessionError);
  if (!sessionData.session?.user) return null;

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", sessionData.session.user.id)
    .single();
  throwIfError(profileError);

  return {
    session: sessionData.session,
    user: sessionData.session.user,
    profile,
  };
}

export function onAuthStateChange(callback) {
  return requireSupabase().auth.onAuthStateChange((_event, session) => callback(session));
}
