
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { COLORS } from '@/constants/colors';

type Stats = {
  students: number;
  teachers: number;
  events: number;
  attendance: number;
};

type MenuItemProps = {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

function MenuItem({
  title,
  subtitle,
  icon,
  onPress,
}: MenuItemProps) {
  return (
    <Pressable style={styles.menuItem} onPress={onPress}>
      <View style={styles.menuIcon}>
        <Ionicons
          name={icon}
          size={22}
          color="#00876A"
        />
      </View>

      <View style={styles.menuText}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSubtitle}>
          {subtitle}
        </Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={20}
        color="#64748b"
      />
    </Pressable>
  );
}

export default function AdminScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState('');

  const [stats, setStats] = useState<Stats>({
    students: 0,
    teachers: 0,
    events: 0,
    attendance: 0,
  });

  const loadDashboard = useCallback(async () => {
    if (!user) {
      setAuthorized(false);
      setLoading(false);
      setError('Please sign in first.');
      return;
    }

    setError('');

    try {
      const { data: profile, error: profileError } =
        await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

      if (profileError) {
        throw new Error(profileError.message);
      }

      if (profile?.role !== 'admin') {
        setAuthorized(false);
        setError(
          'Only administrators can access this dashboard.'
        );
        return;
      }

      setAuthorized(true);

      const [
        studentsResult,
        teachersResult,
        eventsResult,
        attendanceResult,
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('*', {
            count: 'exact',
            head: true,
          })
          .eq('role', 'student'),

        supabase
          .from('profiles')
          .select('*', {
            count: 'exact',
            head: true,
          })
          .eq('role', 'teacher'),

        supabase
          .from('events')
          .select('*', {
            count: 'exact',
            head: true,
          }),

        supabase
          .from('attendance')
          .select('*', {
            count: 'exact',
            head: true,
          }),
      ]);

      const queryError =
        studentsResult.error ||
        teachersResult.error ||
        eventsResult.error ||
        attendanceResult.error;

      if (queryError) {
        throw new Error(queryError.message);
      }

      setStats({
        students: studentsResult.count ?? 0,
        teachers: teachersResult.count ?? 0,
        events: eventsResult.count ?? 0,
        attendance: attendanceResult.count ?? 0,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load dashboard.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadDashboard();
    }, [loadDashboard])
  );

  const refreshStats = () => {
    setRefreshing(true);
    void loadDashboard();
  };

  const possibleAttendances =
    stats.students * stats.events;

  const attendanceRate =
    possibleAttendances > 0
      ? Math.min(
          100,
          Math.round(
            (stats.attendance / possibleAttendances) *
              100
          )
        )
      : 0;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
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

        <Text style={styles.accessTitle}>
          Access Restricted
        </Text>

        <Text style={styles.accessText}>
          {error ||
            'Administrator access is required.'}
        </Text>

        <Pressable
          style={styles.primaryButton}
          onPress={() => router.replace('/')}
        >
          <Text style={styles.primaryButtonText}>
            Go Home
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
      <Text style={styles.heading}>
        Admin Dashboard
      </Text>

      <Text style={styles.subtitle}>
        QR-ATT School Attendance Management
      </Text>

      <View style={styles.adminBadge}>
        <Ionicons
          name="shield-checkmark-outline"
          size={16}
          color="#166534"
        />
        <Text style={styles.adminBadgeText}>
          Administrator
        </Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {error}
          </Text>
        </View>
      ) : null}

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Ionicons
            name="people-outline"
            size={24}
            color="#00876A"
          />
          <Text style={styles.statLabel}>
            Students
          </Text>
          <Text style={styles.statValue}>
            {stats.students}
          </Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons
            name="school-outline"
            size={24}
            color="#00876A"
          />
          <Text style={styles.statLabel}>
            Teachers
          </Text>
          <Text style={styles.statValue}>
            {stats.teachers}
          </Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons
            name="calendar-outline"
            size={24}
            color="#00876A"
          />
          <Text style={styles.statLabel}>
            Events
          </Text>
          <Text style={styles.statValue}>
            {stats.events}
          </Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons
            name="checkbox-outline"
            size={24}
            color="#00876A"
          />
          <Text style={styles.statLabel}>
            Attendance
          </Text>
          <Text style={styles.statValue}>
            {stats.attendance}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>
        System Management
      </Text>

      <MenuItem
        title="Manage Users"
        subtitle="View and manage registered accounts"
        icon="people-outline"
        onPress={() => router.push('/manage-users')}
      />

      <MenuItem
        title="Manage Events"
        subtitle="View, create, and manage school events"
        icon="calendar-outline"
        onPress={() => router.push('/manage-events')}
      />

      <MenuItem
        title="Attendance Records"
        subtitle="View attendance for all school events"
        icon="clipboard-outline"
        onPress={() =>
          router.push('/attendance-monitoring')
        }
      />

      <MenuItem
        title="Reports & Analytics"
        subtitle="View attendance statistics and summaries"
        icon="bar-chart-outline"
        onPress={() => router.push('/reports')}
      />

      <MenuItem
        title="System Logs"
        subtitle="Review recorded system activities"
        icon="document-text-outline"
        onPress={() => router.push('/system-logs')}
      />

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>
          Attendance Summary
        </Text>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>
            Total students
          </Text>
          <Text style={styles.summaryValue}>
            {stats.students}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>
            Total teachers
          </Text>
          <Text style={styles.summaryValue}>
            {stats.teachers}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>
            Total events
          </Text>
          <Text style={styles.summaryValue}>
            {stats.events}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>
            Recorded attendances
          </Text>
          <Text style={styles.summaryValue}>
            {stats.attendance}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>
            Overall attendance rate
          </Text>
          <Text style={styles.summaryValue}>
            {attendanceRate}%
          </Text>
        </View>

        <Text style={styles.note}>
          Estimated rate assumes every student is
          expected to attend every event. This is not
          a per-event attendance report.
        </Text>
      </View>

      <Pressable
        style={styles.refreshButton}
        onPress={refreshStats}
        disabled={refreshing}
      >
        {refreshing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons
              name="refresh-outline"
              size={18}
              color="#fff"
            />
            <Text style={styles.refreshButtonText}>
              Refresh Statistics
            </Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    padding: 16,
    paddingBottom: 40,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: COLORS.background,
  },

  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },

  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 14,
  },

  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },

  adminBadgeText: {
    color: '#166534',
    fontWeight: '700',
    fontSize: 13,
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },

  statCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 18,
    width: '48%',
    flexGrow: 1,
  },

  statLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 10,
  },

  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 4,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },

  menuItem: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },

  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#dcf7ed',
    alignItems: 'center',
    justifyContent: 'center',
  },

  menuText: {
    flex: 1,
  },

  menuTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },

  menuSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  summaryCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    marginBottom: 16,
  },

  summaryTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 18,
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },

  summaryLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },

  summaryValue: {
    color: '#00876A',
    fontSize: 14,
    fontWeight: '700',
  },

  note: {
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 17,
    marginTop: 16,
  },

  refreshButton: {
    backgroundColor: '#00876A',
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },

  refreshButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },

  loadingText: {
    marginTop: 12,
    color: COLORS.textSecondary,
  },

  accessTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 14,
    marginBottom: 8,
  },

  accessText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },

  primaryButton: {
    backgroundColor: '#00876A',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
  },

  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },

  errorBox: {
    backgroundColor: '#fee2e2',
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
  },

  errorText: {
    color: '#b91c1c',
    fontSize: 13,
  },
});
