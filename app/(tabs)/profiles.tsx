
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { useAuth, signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

type Role = 'student' | 'teacher' | 'admin';

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
};

export default function ProfileScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [testingSecurity, setTestingSecurity] = useState(false);
  const [securityResult, setSecurityResult] = useState('');

  const loadProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoadingProfile(false);
      return;
    }

    setLoadingProfile(true);
    setErrorMessage('');

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error(
          'Your profile was not found or cannot be accessed.'
        );
      }

      if (
        data.role !== 'student' &&
        data.role !== 'teacher' &&
        data.role !== 'admin'
      ) {
        throw new Error('Your account has an invalid role.');
      }

      const loadedProfile = data as Profile;

      setProfile(loadedProfile);
      setDraftName(loadedProfile.full_name ?? '');
    } catch (error: any) {
      console.error('Profile loading error:', error);

      setProfile(null);
      setErrorMessage(
        error?.message || 'Unable to load your profile.'
      );
    } finally {
      setLoadingProfile(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile])
  );

  const handleSaveName = async () => {
    if (!user || saving) return;

    const name = draftName.trim();

    if (!name) {
      Alert.alert('Error', 'Please enter your full name.');
      return;
    }

    setSaving(true);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ full_name: name })
        .eq('id', user.id)
        .select('id, email, full_name, role')
        .single();

      if (error) throw error;

      setProfile(data as Profile);
      setDraftName(name);
      setEditing(false);

      Alert.alert('Success', 'Your name has been updated.');
    } catch (error: any) {
      Alert.alert(
        'Update Failed',
        error?.message || 'Unable to update your name.'
      );
    } finally {
      setSaving(false);
    }
  };

  // TEMPORARY SECURITY TEST
  // Use only with a disposable Teacher test account.
  const testRoleSecurity = async () => {
    if (!user || profile?.role !== 'teacher') {
      setSecurityResult(
        'Sign in with your Teacher test account first.'
      );
      return;
    }

    if (testingSecurity) return;

    setTestingSecurity(true);
    setSecurityResult('');

    try {
      // Attempt an unauthorized promotion.
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', user.id);

      // Verify the actual stored role even if the update
      // request reports an error.
      const { data: verifiedProfile, error: verifyError } =
        await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

      if (verifyError) throw verifyError;

      if (verifiedProfile?.role === 'admin') {
        setSecurityResult(
          'SECURITY TEST FAILED: Teacher became Admin! ' +
          'The database permissions need to be fixed.'
        );
      } else if (updateError) {
        setSecurityResult(
          'SECURITY TEST PASSED: The database rejected ' +
          'the unauthorized role change.\n\n' +
          'Database response: ' + updateError.message
        );
      } else {
        setSecurityResult(
          'Role remains ' + verifiedProfile?.role +
          '. The update did not promote the account, ' +
          'but no database rejection was reported. ' +
          'Review the update policy and trigger.'
        );
      }

      await loadProfile();
    } catch (error: any) {
      setSecurityResult(
        'TEST ERROR: ' +
        (error?.message || 'Unable to verify role security.')
      );
    } finally {
      setTestingSecurity(false);
    }
  };

  const handleSignOut = async () => {
    if (signingOut) return;

    setSigningOut(true);

    try {
      await signOut();
      router.replace('/login');
    } catch (error: any) {
      Alert.alert(
        'Sign Out Failed',
        error?.message || 'Unable to sign out.'
      );
    } finally {
      setSigningOut(false);
    }
  };

  const getRoleLabel = (role: Role) => {
    switch (role) {
      case 'admin':
        return 'Administrator';
      case 'teacher':
        return 'Teacher';
      case 'student':
        return 'Student';
    }
  };

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>My Profile</Text>
        <Text style={styles.subtitle}>
          Please sign in to view your profile.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>My Profile</Text>

      {loadingProfile ? (
        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
          />
          <Text style={styles.subtitle}>
            Loading your profile...
          </Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>
            Unable to Load Profile
          </Text>

          <Text style={styles.errorText}>
            {errorMessage}
          </Text>

          <Pressable
            style={styles.primaryButton}
            onPress={() => void loadProfile()}
          >
            <Text style={styles.primaryButtonText}>
              Try Again
            </Text>
          </Pressable>
        </View>
      ) : profile ? (
        <View style={styles.infoCard}>
          <Text style={styles.label}>Full Name</Text>

          {editing ? (
            <View style={styles.editRow}>
              <TextInput
                style={styles.nameInput}
                value={draftName}
                onChangeText={setDraftName}
                placeholder="Enter your full name"
                placeholderTextColor={COLORS.textSecondary}
                autoCapitalize="words"
                editable={!saving}
              />

              <Pressable
                style={styles.saveButton}
                onPress={() => void handleSaveName()}
                disabled={saving}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? 'Saving...' : 'Save'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setDraftName(profile.full_name ?? '');
                  setEditing(false);
                }}
                disabled={saving}
              >
                <Text style={styles.cancelText}>
                  Cancel
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={styles.nameRow}
              onPress={() => {
                setDraftName(profile.full_name ?? '');
                setEditing(true);
              }}
            >
              <Text style={styles.value}>
                {profile.full_name || 'No name set'}
              </Text>

              <Text style={styles.editHint}>
                Edit
              </Text>
            </Pressable>
          )}

          <Text style={styles.label}>Role</Text>

          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>
              {getRoleLabel(profile.role)}
            </Text>
          </View>

          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>
            {profile.email || user.email || 'No email'}
          </Text>

          <Text style={styles.label}>User ID</Text>
          <Text style={styles.valueSmall}>
            {user.id}
          </Text>
        </View>
      ) : null}

      {/* TEMPORARY TEACHER SECURITY TEST */}
      {profile?.role === 'teacher' && (
        <View style={styles.securityCard}>
          <Text style={styles.securityTitle}>
            Role-Based Security Test
          </Text>

          <Text style={styles.securityDescription}>
            Verify that a Teacher cannot change their
            account role to Administrator.
          </Text>

          <Pressable
            style={[
              styles.primaryButton,
              testingSecurity && styles.disabled,
            ]}
            onPress={() => void testRoleSecurity()}
            disabled={testingSecurity}
          >
            {testingSecurity ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                Test Role Security
              </Text>
            )}
          </Pressable>

          {securityResult ? (
            <View
              style={[
                styles.resultBox,
                securityResult.startsWith(
                  'SECURITY TEST PASSED'
                )
                  ? styles.passedBox
                  : styles.warningBox,
              ]}
            >
              <Text style={styles.resultText}>
                {securityResult}
              </Text>
            </View>
          ) : null}
        </View>
      )}

      <AppButton
        title={signingOut ? 'Signing Out...' : 'Sign Out'}
        icon="log-out-outline"
        onPress={() => void handleSignOut()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },

  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 35,
    gap: 12,
  },

  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },

  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 18,
    marginBottom: 24,
  },

  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 16,
    marginBottom: 6,
  },

  value: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },

  valueSmall: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },

  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },

  editHint: {
    color: COLORS.primary,
    fontWeight: '600',
  },

  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  nameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.background,
  },

  saveButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  cancelText: {
    color: COLORS.textSecondary,
  },

  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },

  roleBadgeText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },

  errorCard: {
    backgroundColor: '#FEE2E2',
    padding: 18,
    borderRadius: 12,
    marginBottom: 24,
  },

  errorTitle: {
    color: '#991B1B',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },

  errorText: {
    color: '#991B1B',
    marginBottom: 12,
    lineHeight: 20,
  },

  primaryButton: {
    backgroundColor: COLORS.primary,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  disabled: {
    opacity: 0.6,
  },

  securityCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
  },

  securityTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },

  securityDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },

  resultBox: {
    borderRadius: 10,
    padding: 14,
    marginTop: 14,
  },

  passedBox: {
    backgroundColor: '#DCFCE7',
  },

  warningBox: {
    backgroundColor: '#FEF3C7',
  },

  resultText: {
    color: '#14532D',
    fontSize: 13,
    lineHeight: 20,
  },
});
