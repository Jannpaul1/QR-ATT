
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
import { COLORS } from '@/constants/colors';

type EventRow = {
  id: string;
  title: string;
  event_code: string;
  event_date: string | null;
  created_by: string | null;
};

type AttendanceRow = {
  id: string;
  student_id: string;
  event_id: string;
  scanned_at: string;
};

type StudentProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type AttendanceDisplay = AttendanceRow & {
  student_name: string;
  student_email: string;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(value));
}

export default function AttendanceMonitoring() {
  const router = useRouter();

  const [events, setEvents] = useState<EventRow[]>([]);
  const [selectedEvent, setSelectedEvent] =
    useState<EventRow | null>(null);

  const [records, setRecords] =
    useState<AttendanceDisplay[]>([]);

  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] =
    useState(false);

  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const loadEvents = useCallback(async () => {
    setLoading(true);
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
        profile?.role !== 'teacher' &&
        profile?.role !== 'admin'
      ) {
        throw new Error(
          'Only teachers and administrators can view attendance.'
        );
      }

      let query = supabase
        .from('events')
        .select(
          'id, title, event_code, event_date, created_by'
        )
        .order('created_at', { ascending: false });

      if (profile.role === 'teacher') {
        query = query.eq('created_by', auth.user.id);
      }

      const { data, error: eventsError } = await query;

      if (eventsError) {
        throw new Error(eventsError.message);
      }

      setEvents((data ?? []) as EventRow[]);
    } catch (err) {
      setEvents([]);
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load events.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const loadAttendance = async (event: EventRow) => {
    setSelectedEvent(event);
    setRecords([]);
    setSearch('');
    setRecordsLoading(true);
    setError('');

    try {
      const { data, error: attendanceError } =
        await supabase
          .from('attendance')
          .select('id, student_id, event_id, scanned_at')
          .eq('event_id', event.id)
          .order('scanned_at', { ascending: false });

      if (attendanceError) {
        throw new Error(attendanceError.message);
      }

      const attendance = (data ?? []) as AttendanceRow[];

      if (attendance.length === 0) {
        setRecords([]);
        return;
      }

      const studentIds = [
        ...new Set(
          attendance.map((item) => item.student_id)
        ),
      ];

      const { data: profiles, error: profilesError } =
        await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', studentIds);

      if (profilesError) {
        throw new Error(
          'Unable to load student profiles: ' +
            profilesError.message
        );
      }

      const students = new Map(
        ((profiles ?? []) as StudentProfile[]).map(
          (student) => [student.id, student]
        )
      );

      const displayRecords = attendance.map((record) => {
        const student = students.get(record.student_id);

        return {
          ...record,
          student_name:
            student?.full_name?.trim() ||
            'Name unavailable',
          student_email: student?.email || '',
        };
      });

      setRecords(displayRecords);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load attendance.'
      );
    } finally {
      setRecordsLoading(false);
    }
  };

  const filteredRecords = records.filter((record) => {
    const keyword = search.trim().toLowerCase();

    return (
      record.student_name.toLowerCase().includes(keyword) ||
      record.student_email.toLowerCase().includes(keyword)
    );
  });

  const goBack = () => {
    if (selectedEvent) {
      setSelectedEvent(null);
      setRecords([]);
      setSearch('');
      setError('');
      void loadEvents();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={goBack}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>
        {selectedEvent
          ? selectedEvent.title
          : 'Attendance Monitoring'}
      </Text>

      <Text style={styles.subtitle}>
        {selectedEvent
          ? `Event code: ${selectedEvent.event_code}`
          : 'Select an event to view student attendance.'}
      </Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />
      ) : selectedEvent ? (
        <>
          <View style={styles.summary}>
            <View>
              <Text style={styles.summaryLabel}>
                Total Attendees
              </Text>
              <Text style={styles.summaryCount}>
                {records.length}
              </Text>
            </View>

            <Pressable
              onPress={() =>
                void loadAttendance(selectedEvent)
              }
              disabled={recordsLoading}
            >
              <Text style={styles.refresh}>
                Refresh
              </Text>
            </Pressable>
          </View>

          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search student name or email..."
            placeholderTextColor={COLORS.textSecondary}
          />

          <Text style={styles.resultCount}>
            {filteredRecords.length} student(s) found
          </Text>

          {recordsLoading ? (
            <ActivityIndicator
              size="large"
              color={COLORS.primary}
            />
          ) : (
            <FlatList
              data={filteredRecords}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={styles.empty}>
                  {search
                    ? 'No students match your search.'
                    : error
                    ? 'Attendance could not be loaded.'
                    : 'No attendance records found.'}
                </Text>
              }
              renderItem={({ item, index }) => (
                <View style={styles.card}>
                  <View style={styles.studentHeader}>
                    <Text style={styles.cardTitle}>
                      {index + 1}. {item.student_name}
                    </Text>

                    <View style={styles.presentBadge}>
                      <Text style={styles.presentText}>
                        Present
                      </Text>
                    </View>
                  </View>

                  {item.student_email ? (
                    <Text style={styles.detail}>
                      Email: {item.student_email}
                    </Text>
                  ) : null}

                  <Text style={styles.detail}>
                    Attended: {formatDateTime(item.scanned_at)}
                  </Text>
                </View>
              )}
            />
          )}
        </>
      ) : (
        <>
          <View style={styles.summary}>
            <Text style={styles.summaryLabel}>
              Total Events: {events.length}
            </Text>

            <Pressable
              onPress={() => void loadEvents()}
            >
              <Text style={styles.refresh}>Refresh</Text>
            </Pressable>
          </View>

          <FlatList
            data={events}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <Text style={styles.empty}>
                {error
                  ? 'Events could not be loaded.'
                  : 'No events available.'}
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable
                style={styles.card}
                onPress={() =>
                  void loadAttendance(item)
                }
              >
                <Text style={styles.cardTitle}>
                  {item.title}
                </Text>

                <Text style={styles.detail}>
                  Event Code: {item.event_code}
                </Text>

                <Text style={styles.detail}>
                  Date: {item.event_date || 'Not specified'}
                </Text>

                <Text style={styles.viewLink}>
                  View Attendance →
                </Text>
              </Pressable>
            )}
          />
        </>
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
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 20,
  },
  summary: {
    backgroundColor: '#dcfce7',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    color: '#166534',
    fontWeight: '600',
    fontSize: 14,
  },
  summaryCount: {
    color: '#166534',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 4,
  },
  refresh: {
    color: '#168365',
    fontWeight: 'bold',
  },
  searchInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 14,
    fontSize: 14,
    marginBottom: 12,
    color: COLORS.textPrimary,
  },
  resultCount: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  studentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    flexShrink: 1,
  },
  detail: {
    color: COLORS.textSecondary,
    marginBottom: 5,
    fontSize: 13,
  },
  presentBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  presentText: {
    color: '#166534',
    fontWeight: '600',
    fontSize: 12,
  },
  viewLink: {
    color: '#168365',
    fontWeight: 'bold',
    marginTop: 10,
  },
  empty: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    marginTop: 40,
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 10,
    marginBottom: 15,
  },
  error: {
    color: '#991b1b',
    fontSize: 13,
  },
});
