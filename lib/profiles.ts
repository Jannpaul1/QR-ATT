import { supabase } from './supabase';

export type Role = 'student' | 'teacher';

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
};

export async function getProfile(
  userId: string
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.log('getProfile error:', error);
    return null;
  }

  console.log('profile data:', data);

  if (!data) {
    return null;
  }

  return data as Profile;
}

export async function updateProfile(
  userId: string,
  updates: {
    full_name?: string;
    role?: Role;
  }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  if (error) {
    console.log('updateProfile error:', error);
  }

  return {
    error: error?.message ?? null,
  };
}

export async function getUserRole(
  userId: string
): Promise<Role | null> {
  const profile = await getProfile(userId);

  return profile?.role ?? null;
}