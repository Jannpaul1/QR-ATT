
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/colors';

type SystemLog = {
  id: string;
  actor_id: string | null;
  action: string;
  description: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
};

type ActorProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type DisplayLog = SystemLog & {
  actor_name: string;
  actor_email: string;
};

type FilterType = 'ALL' | 'EVENTS' | 'ATTENDANCE' | 'USERS';

const ACTION_LABELS: Record<string, string> = {
  EVENT_CREATED: 'Event Created',
  EVENT_UPDATED: 'Event Updated',
  EVENT_DELETED: 'Event Deleted',
  ATTENDANCE_RECORDED: 'Attendance Recorded',
  ATTENDANCE_DELETED: 'Attendance Deleted',
  USER_ROLE_CHANGED: 'User Role Changed',
};

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'EVENTS', label: 'Events' },
  { key: 'ATTENDANCE', label: 'Attendance' },
  { key: 'USERS', label: 'Users' },
];

export default function SystemLogsScreen() {
  const router = useRouter();

  const [logs, setLogs] = useState<DisplayLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterType>('ALL');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      // Get currently signed-in user
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        throw new Error('Please sign in first.');
      }

      // Verify administrator role
      const { data: profile, error: profileError } =
        await supabase
          .from('profiles')
          .select('role')
          .eq('id', auth.user.id)
          .single();

      if (profileError) {
        throw new Error(profileError.message);
      }

      if (profile?.role !== 'admin') {
        throw new Error(
          'Only administrators can view system logs.'
        );
      }

      // Fetch system logs
      const { data, error: logsError } =
        await supabase
          .from('system_logs')
          .select(
            'id, actor_id, action, description, entity_type, entity_id, created_at'
          )
          .order('created_at', { ascending: false })
          .limit(200);

      if (logsError) {
        throw new Error(logsError.message);
      }

      const rawLogs = (data ?? []) as SystemLog[];

      if (rawLogs.length === 0) {
        setLogs([]);
        return;
      }

      // Collect unique actor IDs
      const actorIds = [
        ...new Set(
          rawLogs
            .map((log) => log.actor_id)
            .filter((id): id is string => Boolean(id))
        ),
      ];

      // Fetch user names and emails
      const actorMap = new Map<string, ActorProfile>();

      if (actorIds.length > 0) {
        const { data: actors, error: actorsError } =
          await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', actorIds);

        if (actorsError) {
          console.warn(
            'Unable to load actor profiles:',
            actorsError.message
          );
        } else {
          for (const actor of (actors ?? []) as ActorProfile[]) {
            actorMap.set(actor.id, actor);
          }
        }
      }

      // Attach names and emails to each log
      const displayLogs: DisplayLog[] = rawLogs.map(
        (log) => {
          const actor = log.actor_id
            ? actorMap.get(log.actor_id)
            : null;

          return {
            ...log,
            actor_name:
              actor?.full_name?.trim() ||
              actor?.email ||
              (log.actor_id ? 'Unknown User' : 'System'),
            actor_email: actor?.email || '',
          };
        }
      );

      setLogs(displayLogs);
    } catch (err) {
      setLogs([]);
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load system logs.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload whenever the screen is opened
  useFocusEffect(
    useCallback(() => {
      void loadLogs();
    }, [loadLogs])
  );

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filter === 'ALL') return true;

      if (filter === 'EVENTS') {
        return log.entity_type === 'events';
      }

      if (filter === 'ATTENDANCE') {
        return log.entity_type === 'attendance';
      }

      if (filter === 'USERS') {
        return log.entity_type === 'profiles';
      }

      return true;
    });
  }, [logs, filter]);

  const formatDate = (value: string) => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString();
  };

  const getActionLabel = (action: string) => {
    return (
      ACTION_LABELS[action] ||
      action.replace(/_/g, ' ')
    );
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/admin');
    }
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={handleBack}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>System Logs</Text>

      <Text style={styles.subtitle}>
        Track events, attendance, and user activities
        in QR-ATT.
      </Text>

      {/* SUMMARY */}
      <View style={styles.summary}>
        <View>
          <Text style={styles.summaryLabel}>
            Recent Activities
          </Text>

          <Text style={styles.summaryNumber}>
            {logs.length}
          </Text>
        </View>

        <Pressable
          onPress={() => void loadLogs()}
          disabled={loading}
        >
          <Text style={styles.refresh}>
            {loading ? 'Loading...' : 'Refresh'}
          </Text>
        </Pressable>
      </View>

      {/* FILTERS */}
      <View style={styles.filters}>
        {FILTERS.map((item) => (
          <Pressable
            key={item.key}
            style={[
              styles.filterButton,
              filter === item.key &&
                styles.filterButtonActive,
            ]}
            onPress={() => setFilter(item.key)}
          >
            <Text
              style={[
                styles.filterText,
                filter === item.key &&
                  styles.filterTextActive,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.resultCount}>
        {filteredLogs.length} activity record(s) found
      </Text>

      {/* ERROR */}
      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.error}>{error}</Text>

          <Pressable
            onPress={() => void loadLogs()}
          >
            <Text style={styles.retry}>Try Again</Text>
          </Pressable>
        </View>
      ) : null}

      {/* LOG LIST */}
      {loading ? (
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
          style={styles.loader}
        />
      ) : (
        <FlatList
          data={filteredLogs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={() => void loadLogs()}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {error
                ? 'Unable to display logs.'
                : 'No system logs found for this filter.'}
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>
                  {getActionLabel(item.action)}
                </Text>

                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {item.entity_type || 'System'}
                  </Text>
                </View>
              </View>

              {/* DESCRIPTION */}
              <Text style={styles.description}>
                {item.description}
              </Text>

              {/* ACTOR */}
              <View style={styles.actorBox}>
                <Text style={styles.actorLabel}>
                  Performed By
                </Text>

                <Text style={styles.actorName}>
                  {item.actor_name}
                </Text>

                {item.actor_email &&
                item.actor_email !== item.actor_name ? (
                  <Text style={styles.actorEmail}>
                    {item.actor_email}
                  </Text>
                ) : null}
              </View>

              {/* DATE */}
              <Text style={styles.detail}>
                Date: {formatDate(item.created_at)}
              </Text>

              {/* RECORD ID */}
              {item.entity_id ? (
                <Text style={styles.recordId}>
                  Record ID: {item.entity_id}
                </Text>
              ) : null}

              {/* FALLBACK ACTOR ID */}
              {item.actor_id &&
              item.actor_name === 'Unknown User' ? (
                <Text style={styles.recordId}>
                  Actor ID: {item.actor_id}
                </Text>
              ) : null}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 20,
  },

  back: {
    color: '#168365',
    fontWeight: '600',
    marginBottom: 20,
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 20,
    lineHeight: 21,
  },

  summary: {
    backgroundColor: '#dcfce7',
    padding: 18,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },

  summaryLabel: {
    fontSize: 13,
    color: '#166534',
  },

  summaryNumber: {
    fontSize: 26,
    fontWeight: '700',
    color: '#166534',
    marginTop: 4,
  },

  refresh: {
    color: '#168365',
    fontWeight: '700',
  },

  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },

  filterButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbe3eb',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },

  filterButtonActive: {
    backgroundColor: '#168365',
    borderColor: '#168365',
  },

  filterText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },

  filterTextActive: {
    color: '#fff',
  },

  resultCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },

  loader: {
    marginTop: 40,
  },

  list: {
    paddingBottom: 30,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 18,
    marginBottom: 12,
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flex: 1,
  },

  badge: {
    backgroundColor: '#dcfce7',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  badgeText: {
    color: '#166534',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },

  description: {
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 14,
    lineHeight: 20,
  },

  actorBox: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },

  actorLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 5,
  },

  actorName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  actorEmail: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  detail: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },

  recordId: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  empty: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    marginTop: 40,
  },

  errorCard: {
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
  },

  error: {
    color: '#b91c1c',
    marginBottom: 10,
  },

  retry: {
    color: '#168365',
    fontWeight: '700',
  },
});
