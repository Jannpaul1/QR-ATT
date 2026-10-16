
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { supabase } from '@/lib/supabase';

type Stats = {
  students: number;
  teachers: number;
  events: number;
  attendance: number;
};

type IconName = React.ComponentProps<
  typeof Ionicons
>['name'];

export default function AdminScreen() {
  const router = useRouter();

  const [stats, setStats] = useState<Stats>({
    students: 0,
    teachers: 0,
    events: 0,
    attendance: 0,
  });

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    setAuthorized(false);

    try {
      // Verify signed-in user
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error(
          'Please sign in to your administrator account.'
        );
      }

      // Verify administrator role
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

      // Fetch live dashboard statistics
      const [students, teachers, events, attendance] =
        await Promise.all([
          supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'student'),

          supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'teacher'),

          supabase
            .from('events')
            .select('*', { count: 'exact', head: true }),

          supabase
            .from('attendance')
            .select('*', { count: 'exact', head: true }),
        ]);

      const results = [
        students,
        teachers,
        events,
        attendance,
      ];

      const failed = results.find((result) => result.error);

      if (failed?.error) {
        throw new Error(failed.error.message);
      }

      setStats({
        students: students.count ?? 0,
        teachers: teachers.count ?? 0,
        events: events.count ?? 0,
        attendance: attendance.count ?? 0,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load dashboard.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const StatCard = ({
    title,
    value,
    icon,
  }: {
    title: string;
    value: number;
    icon: IconName;
  }) => (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <Text style={styles.statLabel}>{title}</Text>
        <Ionicons
          name={icon}
          size={23}
          color="#168365"
        />
      </View>

      <Text style={styles.statNumber}>{value}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color="#168365"
        />
        <Text style={styles.loadingText}>
          Loading Admin Dashboard...
        </Text>
      </View>
    );
  }

  if (!authorized) {
    return (
      <View style={styles.center}>
        <Ionicons
          name="lock-closed-outline"
          size={48}
          color="#dc2626"
        />

        <Text style={styles.error}>{error}</Text>

        <Pressable
          style={styles.primaryButton}
          onPress={() => router.replace('/login')}
        >
          <Text style={styles.primaryButtonText}>
            Go to Login
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>
            Admin Dashboard
          </Text>

          <Text style={styles.subtitle}>
            QR-ATT School Attendance Management
          </Text>
        </View>

        <View style={styles.adminBadge}>
          <Ionicons
            name="shield-checkmark"
            size={16}
            color="#168365"
          />
          <Text style={styles.adminBadgeText}>
            Administrator
          </Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <StatCard
          title="Students"
          value={stats.students}
          icon="school-outline"
        />

        <StatCard
          title="Teachers"
          value={stats.teachers}
          icon="people-outline"
        />

        <StatCard
          title="Events"
          value={stats.events}
          icon="calendar-outline"
        />

        <StatCard
          title="Attendance"
          value={stats.attendance}
          icon="checkmark-circle-outline"
        />
      </View>

      <Text style={styles.sectionTitle}>
        System Management
      </Text>

      {/* FUNCTIONAL USER MANAGEMENT */}
      <Pressable
        style={styles.menuCard}
        onPress={() => router.push('/manage-users')}
      >
        <View style={styles.menuLeft}>
          <View style={styles.menuIcon}>
            <Ionicons
              name="people-outline"
              size={24}
              color="#168365"
            />
          </View>

          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>
              Manage Users
            </Text>

            <Text style={styles.menuDescription}>
              View and search registered accounts
            </Text>
          </View>
        </View>

        <Ionicons
          name="chevron-forward"
          size={22}
          color="#64748b"
        />
      </Pressable>

      {/* UPCOMING FEATURES */}
      {[
        {
          title: 'Manage Events',
          description: 'Create, edit and close events',
          icon: 'calendar-outline' as IconName,
        },
        {
          title: 'Attendance Records',
          description: 'Monitor event attendance',
          icon: 'clipboard-outline' as IconName,
        },
        {
          title: 'Reports & Analytics',
          description: 'View attendance summaries',
          icon: 'bar-chart-outline' as IconName,
        },
        {
          title: 'System Logs',
          description: 'Review system activity',
          icon: 'document-text-outline' as IconName,
        },
      ].map((item) => (
        <View key={item.title} style={styles.menuCard}>
          <View style={styles.menuLeft}>
            <View style={styles.menuIcon}>
              <Ionicons
                name={item.icon}
                size={24}
                color="#168365"
              />
            </View>

            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>
                {item.title}
              </Text>

              <Text style={styles.menuDescription}>
                {item.description}
              </Text>
            </View>
          </View>

          <Text style={styles.comingSoon}>
            Coming next
          </Text>
        </View>
      ))}

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}

      <Pressable
        style={styles.refreshButton}
        onPress={loadDashboard}
      >
        <Ionicons
          name="refresh-outline"
          size={19}
          color="#ffffff"
        />

        <Text style={styles.refreshText}>
          Refresh Statistics
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7f6',
  },
  content: {
    padding: 20,
    paddingBottom: 50,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
    backgroundColor: '#f5f7f6',
  },
  loadingText: {
    color: '#64748b',
    fontSize: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#162c25',
  },
  subtitle: {
    color: '#64748b',
    marginTop: 6,
    fontSize: 14,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#e1f5eb',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  adminBadgeText: {
    color: '#168365',
    fontWeight: 'bold',
    fontSize: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    flexBasis: '40%',
    flexGrow: 1,
    minWidth: 145,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    color: '#64748b',
    fontSize: 14,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#168365',
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#162c25',
    marginTop: 30,
    marginBottom: 14,
  },
  menuCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  menuIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#e1f5eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuInfo: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#162c25',
  },
  menuDescription: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  comingSoon: {
    color: '#94a3b8',
    fontSize: 12,
  },
  refreshButton: {
    backgroundColor: '#168365',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  refreshText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  primaryButton: {
    backgroundColor: '#168365',
    padding: 15,
    borderRadius: 10,
    minWidth: 150,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  error: {
    color: '#dc2626',
    textAlign: 'center',
    fontSize: 14,
    marginTop: 12,
  },
});
