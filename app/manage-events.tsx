
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

type EventItem = {
  id: string;
  event_code: string;
  title: string;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  description: string | null;
  status: string | null;
  created_by: string | null;
};

export default function ManageEventsScreen() {
  const router = useRouter();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [role, setRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
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

      if (
        profile?.role !== 'admin' &&
        profile?.role !== 'teacher'
      ) {
        throw new Error(
          'Only teachers and administrators can manage events.'
        );
      }

      const { data, error: eventsError } = await supabase
        .from('events')
        .select(
          'id, event_code, title, event_date, start_time, end_time, venue, description, status, created_by'
        )
        .order('created_at', { ascending: false });

      if (eventsError) {
        throw new Error(eventsError.message);
      }

      setRole(profile.role);
      setCurrentUserId(auth.user.id);
      setEvents((data ?? []) as EventItem[]);
    } catch (err) {
      setEvents([]);
      setRole(null);
      setCurrentUserId(null);
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load events.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const refreshEvents = () => {
    setRefreshing(true);
    void loadEvents();
  };

  const filteredEvents = events.filter((event) => {
    const keyword = search.trim().toLowerCase();

    return (
      event.title.toLowerCase().includes(keyword) ||
      event.event_code.toLowerCase().includes(keyword) ||
      (event.venue ?? '').toLowerCase().includes(keyword)
    );
  });

  const formatDate = (value: string | null) => {
    return value || 'Not specified';
  };

  const formatTime = (value: string | null) => {
    if (!value) return 'Not specified';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return 'Invalid time';
    }

    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => router.back()}
        style={styles.backButton}
      >
        <Text style={styles.back}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Manage Events</Text>
      <Text style={styles.subtitle}>
        View and manage school events
      </Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#168365" />
          <Text style={styles.muted}>Loading events...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>

          <Pressable
            style={styles.primaryButton}
            onPress={refreshEvents}
          >
            <Text style={styles.primaryText}>Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <TextInput
            style={styles.search}
            placeholder="Search events..."
            value={search}
            onChangeText={setSearch}
          />

          <View style={styles.summary}>
            <Text style={styles.count}>
              {filteredEvents.length} events found
            </Text>

            <Text style={styles.muted}>
              Total events: {events.length}
            </Text>
          </View>

          <FlatList
            data={filteredEvents}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>
                  No events found
                </Text>
                <Text style={styles.muted}>
                  Create your first school event to get started.
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const canGenerateQR =
                role === 'admin' ||
                (role === 'teacher' &&
                  item.created_by === currentUserId);

              return (
                <View style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text style={styles.eventTitle}>
                      {item.title}
                    </Text>

                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>
                        {item.status || 'open'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.eventCode}>
                    Code: {item.event_code}
                  </Text>

                  <Text style={styles.detail}>
                    Date: {formatDate(item.event_date)}
                  </Text>

                  <Text style={styles.detail}>
                    Time: {formatTime(item.start_time)} –{' '}
                    {formatTime(item.end_time)}
                  </Text>

                  <Text style={styles.detail}>
                    Venue: {item.venue || 'Not specified'}
                  </Text>

                  {item.description ? (
                    <Text style={styles.description}>
                      {item.description}
                    </Text>
                  ) : null}

                  {canGenerateQR && (
                    <Pressable
                      style={styles.qrButton}
                      onPress={() =>
                        router.push({
                          pathname: '/event-qr',
                          params: { id: item.id },
                        })
                      }
                    >
                      <Text style={styles.qrButtonText}>
                        Generate QR Code
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            }}
          />

          {(role === 'admin' || role === 'teacher') && (
            <Pressable
              style={styles.primaryButton}
              onPress={() => router.push('/create-event')}
            >
              <Text style={styles.primaryText}>
                + Create New Event
              </Text>
            </Pressable>
          )}

          <Pressable
            style={styles.refreshButton}
            disabled={refreshing}
            onPress={refreshEvents}
          >
            <Text style={styles.refreshText}>
              {refreshing ? 'Refreshing...' : 'Refresh Events'}
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
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 18,
  },
  back: {
    color: '#168365',
    fontWeight: '600',
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
  muted: {
    color: '#64748b',
  },
  error: {
    color: '#dc2626',
    textAlign: 'center',
  },
  search: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbe3e8',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  count: {
    color: '#168365',
    fontWeight: 'bold',
  },
  listContent: {
    paddingBottom: 18,
  },
  card: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  eventTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#162c25',
  },
  statusBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusText: {
    color: '#166534',
    fontWeight: '600',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  eventCode: {
    color: '#168365',
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 10,
  },
  detail: {
    color: '#475569',
    marginBottom: 5,
  },
  description: {
    color: '#64748b',
    marginTop: 10,
    lineHeight: 20,
  },
  qrButton: {
    backgroundColor: '#168365',
    padding: 13,
    borderRadius: 9,
    alignItems: 'center',
    marginTop: 16,
  },
  qrButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyBox: {
    alignItems: 'center',
    padding: 30,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#162c25',
  },
  primaryButton: {
    backgroundColor: '#168365',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  primaryText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  refreshButton: {
    alignItems: 'center',
    padding: 14,
    marginTop: 8,
  },
  refreshText: {
    color: '#168365',
    fontWeight: '600',
  },
});
