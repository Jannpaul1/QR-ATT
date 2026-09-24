import { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Alert,
  TextInput,
  Pressable,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { useAuth, signOut } from '@/lib/auth';
import {
  getProfile,
  updateProfile,
  type Profile,
} from '@/lib/profiles';

export default function ProfileScreen() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');

  const router = useRouter();

  const loadProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }

    const data = await getProfile(user.id);

    console.log('Loaded profile:', data);

    setProfile(data);
    setDraftName(data?.full_name ?? '');
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const handleSaveName = async () => {
    if (!user) {
      return;
    }

    const name = draftName.trim();

    if (!name) {
      Alert.alert('Error', 'Please enter your name.');
      return;
    }

    setSaving(true);

    const { error } = await updateProfile(user.id, {
      full_name: name,
    });

    setSaving(false);

    if (error) {
      Alert.alert('Error', error);
      return;
    }

    setProfile((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        full_name: name,
      };
    });

    setDraftName(name);
    setEditing(false);

    Alert.alert('Success', 'Your name has been updated.');
  };

  const handleSignOut = async () => {
    setLoading(true);

    try {
      await signOut();
      router.replace('/login');
    } catch (error: any) {
      Alert.alert(
        'Error',
        error?.message || 'Failed to sign out.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>My Profile</Text>

        <View style={styles.infoCard}>
          <Text style={styles.emptyText}>
            Please log in to view your profile.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Profile</Text>

      <View style={styles.infoCard}>
        {/* FULL NAME */}
        <Text style={styles.label}>Full Name</Text>

        {editing ? (
          <View style={styles.nameEditRow}>
            <TextInput
              style={styles.nameInput}
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Enter your full name"
              placeholderTextColor={COLORS.textSecondary}
              editable={!saving}
              autoCapitalize="words"
            />

            <Pressable
              style={[
                styles.saveButton,
                saving && styles.disabledButton,
              ]}
              onPress={handleSaveName}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>
                {saving ? '...' : 'Save'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={styles.nameRow}
            onPress={() => {
              setDraftName(profile?.full_name ?? '');
              setEditing(true);
            }}
          >
            <Text style={styles.value}>
              {profile?.full_name || 'No name set'}
            </Text>

            <Text style={styles.editHint}>Edit</Text>
          </Pressable>
        )}

        {/* ROLE */}
        <Text style={styles.label}>Role</Text>

        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>
            {profile?.role === 'teacher'
              ? 'Teacher'
              : 'Student'}
          </Text>
        </View>

        {/* EMAIL */}
        <Text style={styles.label}>Email</Text>

        <Text style={styles.value}>
          {profile?.email || user.email || 'No email'}
        </Text>

        {/* USER ID */}
        <Text style={styles.label}>User ID</Text>

        <Text style={styles.valueSmall}>
          {user.id}
        </Text>
      </View>

      <AppButton
        title={loading ? 'Signing Out...' : 'Sign Out'}
        icon="log-out-outline"
        onPress={handleSignOut}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
    paddingTop: 24,
  },

  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },

  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },

  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
    marginTop: 12,
  },

  value: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },

  valueSmall: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },

  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },

  editHint: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },

  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  nameInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.textPrimary,
  },

  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  disabledButton: {
    opacity: 0.5,
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },

  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },

  roleBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },

  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});