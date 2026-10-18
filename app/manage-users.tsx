
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

type Role = 'student' | 'teacher' | 'admin';
type AssignableRole = 'student' | 'teacher';

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
};

export default function ManageUsersScreen() {
  const router = useRouter();

  const [users, setUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotice('');
    setAuthorized(false);
    setUsers([]);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error(
          'Please sign in to your administrator account.'
        );
      }

      const { data: profile, error: profileError } =
        await supabase
          .from('profiles')
          .select('role')
          .eq('id', authData.user.id)
          .single();

      if (profileError) {
        throw new Error(profileError.message);
      }

      if (profile?.role !== 'admin') {
        throw new Error(
          'Access denied. Administrator account required.'
        );
      }

      setAuthorized(true);

      const { data, error: usersError } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .order('full_name', { ascending: true });

      if (usersError) {
        throw new Error(usersError.message);
      }

      setUsers((data ?? []) as Profile[]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load users.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const changeRole = async (
    user: Profile,
    newRole: AssignableRole
  ) => {
    if (
      !authorized ||
      user.role === 'admin' ||
      user.role === newRole ||
      savingId !== null
    ) {
      return;
    }

    setSavingId(user.id);
    setNotice('');

    try {
      const { error: rpcError } = await supabase.rpc(
        'admin_change_user_role',
        {
          p_user_id: user.id,
          p_new_role: newRole,
        }
      );

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      // Fetch the saved role from the database.
      const { data: updated, error: fetchError } =
        await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

      if (fetchError) {
        throw new Error(
          'Role change submitted, but verification failed: ' +
            fetchError.message
        );
      }

      if (updated?.role !== newRole) {
        throw new Error(
          'The database did not confirm the new role.'
        );
      }

      setUsers((previous) =>
        previous.map((item) =>
          item.id === user.id
            ? { ...item, role: newRole }
            : item
        )
      );

      setEditingId(null);
      setNotice(
        `${user.full_name || user.email} is now a ${newRole}.`
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to change the user role.';

      Alert.alert('Role Change Failed', message);
      setNotice(`Error: ${message}`);
    } finally {
      setSavingId(null);
    }
  };

  const confirmRoleChange = (
    user: Profile,
    newRole: AssignableRole
  ) => {
    if (user.role === 'admin' || user.role === newRole) {
      return;
    }

    const name = user.full_name || user.email;
    const message =
      `Change ${name} from ${user.role} to ${newRole}?`;

    // Browser confirmation for Expo Web.
    if (typeof window !== 'undefined' &&
        typeof window.confirm === 'function') {
      if (window.confirm(message)) {
        void changeRole(user, newRole);
      }
      return;
    }

    // Native Android/iOS confirmation.
    Alert.alert('Confirm Role Change', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: () => void changeRole(user, newRole),
      },
    ]);
  };

  const filteredUsers = users.filter((item) => {
    const keyword = search.toLowerCase().trim();

    return (
      (item.full_name ?? '').toLowerCase().includes(keyword) ||
      item.email.toLowerCase().includes(keyword) ||
      item.role.toLowerCase().includes(keyword)
    );
  });

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => router.replace('/admin')}
        style={styles.backButton}
      >
        <Text style={styles.back}>← Back to Dashboard</Text>
      </Pressable>

      <Text style={styles.title}>Manage Users</Text>
      <Text style={styles.subtitle}>
        View and manage registered QR-ATT accounts
      </Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#168365" />
          <Text style={styles.loadingText}>
            Checking administrator access...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>

          <Pressable style={styles.refresh} onPress={loadUsers}>
            <Text style={styles.refreshText}>Try Again</Text>
          </Pressable>

          <Pressable onPress={() => router.replace('/login')}>
            <Text style={styles.loginLink}>Go to Login</Text>
          </Pressable>
        </View>
      ) : authorized ? (
        <>
          <TextInput
            style={styles.search}
            placeholder="Search name, email, or role..."
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />

          <View style={styles.summary}>
            <Text style={styles.count}>
              {filteredUsers.length} users found
            </Text>
            <Text style={styles.total}>
              Total registered: {users.length}
            </Text>
          </View>

          {notice ? (
            <Text
              style={[
                styles.notice,
                notice.startsWith('Error:') && styles.errorNotice,
              ]}
            >
              {notice}
            </Text>
          ) : null}

          <FlatList
            data={filteredUsers}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.empty}>
                No matching users found.
              </Text>
            }
            renderItem={({ item }) => {
              const isEditing = editingId === item.id;
              const isSaving = savingId === item.id;
              const isAdmin = item.role === 'admin';

              return (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {(item.full_name || item.email)
                          .charAt(0)
                          .toUpperCase()}
                      </Text>
                    </View>

                    <View style={styles.userInfo}>
                      <Text style={styles.name}>
                        {item.full_name || 'Unnamed User'}
                      </Text>

                      <Text style={styles.email}>
                        {item.email}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.roleRow}>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {isAdmin
                          ? 'Administrator'
                          : item.role === 'teacher'
                          ? 'Teacher'
                          : 'Student'}
                      </Text>
                    </View>

                    {!isAdmin && (
                      <Pressable
                        style={styles.editButton}
                        disabled={savingId !== null}
                        onPress={() =>
                          setEditingId(
                            isEditing ? null : item.id
                          )
                        }
                      >
                        <Text style={styles.editText}>
                          {isEditing ? 'Cancel' : 'Change Role'}
                        </Text>
                      </Pressable>
                    )}
                  </View>

                  {isAdmin && (
                    <Text style={styles.protected}>
                      Administrator account is protected.
                    </Text>
                  )}

                  {isEditing && !isAdmin && (
                    <View style={styles.roleEditor}>
                      <Text style={styles.editorTitle}>
                        Assign a new role
                      </Text>

                      {isSaving ? (
                        <ActivityIndicator color="#168365" />
                      ) : (
                        <View style={styles.roleOptions}>
                          <Pressable
                            style={[
                              styles.option,
                              item.role === 'student' &&
                                styles.selectedOption,
                            ]}
                            disabled={
                              savingId !== null ||
                              item.role === 'student'
                            }
                            onPress={() =>
                              confirmRoleChange(item, 'student')
                            }
                          >
                            <Text style={styles.optionText}>
                              Student
                            </Text>
                          </Pressable>

                          <Pressable
                            style={[
                              styles.option,
                              item.role === 'teacher' &&
                                styles.selectedOption,
                            ]}
                            disabled={
                              savingId !== null ||
                              item.role === 'teacher'
                            }
                            onPress={() =>
                              confirmRoleChange(item, 'teacher')
                            }
                          >
                            <Text style={styles.optionText}>
                              Teacher
                            </Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            }}
          />

          <Pressable
            style={styles.refresh}
            disabled={savingId !== null}
            onPress={loadUsers}
          >
            <Text style={styles.refreshText}>
              Refresh Users
            </Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7f6',
    padding: 20,
  },
  backButton: {
    marginBottom: 18,
    alignSelf: 'flex-start',
  },
  back: {
    color: '#168365',
    fontWeight: '600',
    fontSize: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#162c25',
  },
  subtitle: {
    color: '#64748b',
    marginTop: 5,
    marginBottom: 22,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 15,
  },
  loadingText: {
    color: '#64748b',
    marginTop: 10,
  },
  error: {
    color: '#dc2626',
    textAlign: 'center',
    fontSize: 15,
  },
  search: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbe3e8',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    fontSize: 15,
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    flexWrap: 'wrap',
    gap: 8,
  },
  count: {
    color: '#168365',
    fontWeight: 'bold',
  },
  total: {
    color: '#64748b',
  },
  notice: {
    color: '#168365',
    fontWeight: '600',
    marginBottom: 12,
  },
  errorNotice: {
    color: '#dc2626',
  },
  listContent: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e1f5eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#168365',
    fontSize: 18,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  name: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#162c25',
    marginBottom: 4,
  },
  email: {
    color: '#64748b',
    fontSize: 13,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  badge: {
    backgroundColor: '#e1f5eb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: '#168365',
    fontWeight: 'bold',
    fontSize: 12,
  },
  editButton: {
    borderWidth: 1,
    borderColor: '#168365',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  editText: {
    color: '#168365',
    fontWeight: 'bold',
    fontSize: 13,
  },
  protected: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 8,
  },
  roleEditor: {
    marginTop: 14,
    padding: 14,
    backgroundColor: '#f1f7f4',
    borderRadius: 10,
  },
  editorTitle: {
    fontWeight: 'bold',
    color: '#162c25',
    marginBottom: 12,
  },
  roleOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  option: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbe3e8',
    alignItems: 'center',
  },
  selectedOption: {
    backgroundColor: '#d1fae5',
    borderColor: '#168365',
  },
  optionText: {
    color: '#162c25',
    fontWeight: '600',
  },
  refresh: {
    backgroundColor: '#168365',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 12,
    minWidth: 140,
  },
  refreshText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  empty: {
    textAlign: 'center',
    color: '#64748b',
    marginTop: 30,
  },
  loginLink: {
    color: '#168365',
    fontWeight: '600',
    marginTop: 12,
  },
});
