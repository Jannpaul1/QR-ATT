
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    setAuthorized(false);
    setUsers([]);

    try {
      // Check the current authenticated session
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error(
          'Please sign in to your administrator account.'
        );
      }

      // Verify administrator role from database
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

      // Retrieve all registered users
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
        err instanceof Error
          ? err.message
          : 'Unable to load users.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

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
        View registered QR-ATT accounts
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

          <Pressable
            style={styles.refresh}
            onPress={loadUsers}
          >
            <Text style={styles.refreshText}>Try Again</Text>
          </Pressable>

          <Pressable
            onPress={() => router.replace('/login')}
          >
            <Text style={styles.loginLink}>
              Go to Login
            </Text>
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

          <FlatList
            data={filteredUsers}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.empty}>
                No matching users found.
              </Text>
            }
            renderItem={({ item }) => (
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

                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {item.role === 'admin'
                      ? 'Administrator'
                      : item.role === 'teacher'
                      ? 'Teacher'
                      : 'Student'}
                  </Text>
                </View>
              </View>
            )}
          />

          <Pressable
            style={styles.refresh}
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
