
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

type AttendanceRecord = {
  id: string;
  event_id: string;
  scanned_at: string;
};

type EventInfo = {
  id: string;
  title: string;
  event_date: string | null;
  venue: string | null;
  event_code: string;
};

type HistoryItem = AttendanceRecord & {
  event: EventInfo | null;
};

export default function AttendanceHistoryScreen() {
  const router = useRouter();

  const [records, setRecords] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadHistory = useCallback(async () => {
    setError('');

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        throw new Error('Please sign in first.');
      }

      const { data: profile, error: profileError } =
        await supabase
          .from('profiles')
          .select('role')
          .eq('id', auth.user.id)
          .single();

      if (profileError) {
        throw new Error(profileError.message);
      }

      if (profile?.role !== 'student') {
        throw new Error(
          'Attendance history is available to student accounts.'
        );
      }

      // Fetch only the signed-in student's records.
      const { data: attendance, error: attendanceError } =
        await supabase
          .from('attendance')
          .select('id, event_id, scanned_at')
          .eq('student_id', auth.user.id)
          .order('scanned_at', { ascending: false });

      if (attendanceError) {
        throw new Error(attendanceError.message);
      }

      const rows = (attendance ?? []) as AttendanceRecord[];

      if (rows.length === 0) {
        setRecords([]);
        return;
      }

      // Fetch event information separately to avoid
      // relying on a particular relationship alias.
      const eventIds = [...new Set(rows.map((r) => r.event_id))];

      const { data: events, error: eventsError } =
        await supabase
          .from('events')
          .select('id, title, event_date, venue, event_code')
          .in('id', eventIds);

      if (eventsError) {
        throw new Error(eventsError.message);
      }

      const eventMap = new Map<string, EventInfo>(
        ((events ?? []) as EventInfo[]).map((event) => [
          event.id,
          event,
        ])
      );

      setRecords(
        rows.map((record) => ({
          ...record,
          event: eventMap.get(record.event_id) ?? null,
        }))
      );
    } catch (err) {
      setRecords([]);
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load attendance history.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const refreshHistory = () => {
    setRefreshing(true);
    void loadHistory();
  };

  const formatTimestamp = (value: string) => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return 'Unknown time';
    }

    return date.toLocaleString();
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Attendance History</Text>
      <Text style={styles.subtitle}>
        View your recorded school event attendance
      </Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#168365" />
          <Text style={styles.muted}>
            Loading attendance history...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>

          <Pressable
            style={styles.button}
            onPress={refreshHistory}
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.summary}>
            <Text style={styles.count}>
              Total Attendance: {records.length}
            </Text>
          </View>

          <FlatList
            data={records}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>
                  No attendance records yet
                </Text>
                <Text style={styles.muted}>
                  Scan an event QR code to record your attendance.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.eventTitle}>
                    {item.event?.title ?? 'Unknown Event'}
                  </Text>

                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      Recorded
                    </Text>
                  </View>
                </View>

                <Text style={styles.detail}>
                  Event Date:{' '}
                  {item.event?.event_date ?? 'Not specified'}
                </Text>

                <Text style={styles.detail}>
                  Venue:{' '}
                  {item.event?.venue ?? 'Not specified'}
                </Text>

                <Text style={styles.detail}>
                  Scanned At: {formatTimestamp(item.scanned_at)}
                </Text>

                {item.event?.event_code ? (
                  <Text style={styles.code}>
                    Code: {item.event.event_code}
                  </Text>
                ) : null}
              </View>
            )}
          />

          <Pressable
            style={styles.button}
            disabled={refreshing}
            onPress={refreshHistory}
          >
            <Text style={styles.buttonText}>
              {refreshing ? 'Refreshing...' : 'Refresh History'}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7f6',
    padding: 20,
  },
  back: {
    color: '#168365',
    fontWeight: '600',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#162c25',
  },
  subtitle: {
    color: '#64748b',
    marginTop: 6,
    marginBottom: 22,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 15,
  },
  muted: {
    color: '#64748b',
    textAlign: 'center',
  },
  error: {
    color: '#dc2626',
    textAlign: 'center',
  },
  summary: {
    marginBottom: 16,
  },
  count: {
    color: '#168365',
    fontWeight: 'bold',
    fontSize: 16,
  },
  list: {
    paddingBottom: 20,
  },
  empty: {
    alignItems: 'center',
    padding: 30,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#162c25',
  },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  eventTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#162c25',
  },
  badge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    color: '#166534',
    fontWeight: '600',
    fontSize: 12,
  },
  detail: {
    color: '#475569',
    marginBottom: 7,
  },
  code: {
    color: '#168365',
    fontWeight: '600',
    marginTop: 8,
  },
  button: {
    backgroundColor: '#168365',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 12,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
