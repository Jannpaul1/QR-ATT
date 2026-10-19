
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { supabase } from '@/lib/supabase';

const GREEN = '#168365';

type EventRow = {
  id: string;
  title: string;
  event_code: string;
  event_date: string | null;
};

type AttendanceRow = {
  id: string;
  event_id: string;
  student_id: string;
  scanned_at: string;
};

type EventReport = EventRow & {
  attendees: number;
  percentage: number;
};

export default function ReportsScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [studentCount, setStudentCount] = useState(0);
  const [teacherCount, setTeacherCount] = useState(0);
  const [events, setEvents] = useState<EventReport[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);

  const loadReports = useCallback(async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        throw new Error('Please log in first.');
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

      if (profile?.role !== 'admin') {
        throw new Error('Administrator access required.');
      }

      const [
        studentsResult,
        teachersResult,
        eventsResult,
        attendanceResult,
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'student'),

        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'teacher'),

        supabase
          .from('events')
          .select('id, title, event_code, event_date')
          .order('created_at', { ascending: false }),

        supabase
          .from('attendance')
          .select('id, event_id, student_id, scanned_at')
          .order('scanned_at', { ascending: false }),
      ]);

      const failed = [
        studentsResult,
        teachersResult,
        eventsResult,
        attendanceResult,
      ].find((result) => result.error);

      if (failed?.error) {
        throw new Error(failed.error.message);
      }

      const totalStudents = studentsResult.count ?? 0;
      const totalTeachers = teachersResult.count ?? 0;
      const eventRows = (eventsResult.data ?? []) as EventRow[];
      const attendanceRows =
        (attendanceResult.data ?? []) as AttendanceRow[];

      const reports: EventReport[] = eventRows.map((event) => {
        const uniqueStudents = new Set(
          attendanceRows
            .filter((record) => record.event_id === event.id)
            .map((record) => record.student_id)
        );

        const attendees = uniqueStudents.size;

        return {
          ...event,
          attendees,
          percentage:
            totalStudents > 0
              ? Math.round((attendees / totalStudents) * 100)
              : 0,
        };
      });

      setStudentCount(totalStudents);
      setTeacherCount(totalTeachers);
      setEvents(reports);
      setAttendance(attendanceRows);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load reports.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadReports();
    }, [loadReports])
  );

  const totalAttendance = attendance.length;

  const overallRate =
    studentCount > 0 && events.length > 0
      ? Math.round(
          (events.reduce((sum, event) => sum + event.attendees, 0) /
            (studentCount * events.length)) *
            100
        )
      : 0;

  const exportCSV = () => {
    if (Platform.OS !== 'web') {
      setError('CSV download is currently available on the web version.');
      return;
    }

    try {
      const escapeCSV = (value: unknown) =>
        `"${String(value ?? '').replace(/"/g, '""')}"`;

      const header = [
        'Event Title',
        'Event Code',
        'Event Date',
        'Attendees',
        'Total Students',
        'Estimated Attendance Rate',
      ];

      const rows = events.map((event) => [
        event.title,
        event.event_code,
        event.event_date ?? '',
        event.attendees,
        studentCount,
        `${event.percentage}%`,
      ]);

      const csv = [header, ...rows]
        .map((row) => row.map(escapeCSV).join(','))
        .join('\r\n');

      // Browser-only APIs are accessed only on web.
      const blob = new Blob(['\uFEFF', csv], {
        type: 'text/csv;charset=utf-8;',
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = 'qr-att-attendance-report.csv';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to export CSV.'
      );
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Pressable
        style={styles.backButton}
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/admin' as any);
          }
        }}
      >
        <Ionicons name="arrow-back" size={18} color={GREEN} />
        <Text style={styles.backText}>Back to Admin</Text>
      </Pressable>

      <Text style={styles.title}>Reports & Analytics</Text>
      <Text style={styles.subtitle}>
        QR-ATT School Attendance Reports
      </Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={GREEN} />
          <Text style={styles.muted}>Loading reports...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorCard}>
          <Text style={styles.error}>{error}</Text>
          <Pressable
            style={styles.button}
            onPress={() => void loadReports(true)}
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.statsGrid}>
            {[
              ['Students', studentCount],
              ['Teachers', teacherCount],
              ['Events', events.length],
              ['Attendances', totalAttendance],
            ].map(([label, value]) => (
              <View style={styles.statCard} key={String(label)}>
                <Text style={styles.statLabel}>{label}</Text>
                <Text style={styles.statValue}>{value}</Text>
              </View>
            ))}
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>
              Estimated Overall Attendance Rate
            </Text>
            <Text style={styles.bigPercentage}>{overallRate}%</Text>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(100, overallRate)}%` },
                ]}
              />
            </View>

            <Text style={styles.note}>
              This estimate assumes every registered student is
              expected to attend every event. It is not based on
              individual event enrollment.
            </Text>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Attendance by Event
            </Text>
            <Text style={styles.muted}>
              {events.length} event(s)
            </Text>
          </View>

          {events.length === 0 ? (
            <View style={styles.eventCard}>
              <Text style={styles.muted}>
                No events available yet.
              </Text>
            </View>
          ) : (
            events.map((event) => (
              <View style={styles.eventCard} key={event.id}>
                <View style={styles.eventHeader}>
                  <View style={styles.eventInfo}>
                    <Text style={styles.eventTitle}>
                      {event.title}
                    </Text>
                    <Text style={styles.muted}>
                      Code: {event.event_code}
                    </Text>
                    <Text style={styles.muted}>
                      Date: {event.event_date || 'Not specified'}
                    </Text>
                  </View>

                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>
                      {event.attendees} attended
                    </Text>
                  </View>
                </View>

                <View style={styles.progressLabel}>
                  <Text style={styles.muted}>
                    Estimated participation
                  </Text>
                  <Text style={styles.percentage}>
                    {event.percentage}%
                  </Text>
                </View>

                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(
                          100,
                          event.percentage
                        )}%`,
                      },
                    ]}
                  />
                </View>

                <Text style={styles.note}>
                  {event.attendees} of {studentCount} registered
                  student(s) recorded attendance.
                </Text>
              </View>
            ))
          )}

          <Pressable
            style={styles.button}
            disabled={refreshing}
            onPress={() => void loadReports(true)}
          >
            {refreshing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Ionicons
                name="refresh-outline"
                size={20}
                color="#fff"
              />
            )}
            <Text style={styles.buttonText}>
              {refreshing ? 'Refreshing...' : 'Refresh Reports'}
            </Text>
          </Pressable>

          {Platform.OS === 'web' && (
            <Pressable
              style={styles.exportButton}
              onPress={exportCSV}
            >
              <Ionicons
                name="download-outline"
                size={20}
                color={GREEN}
              />
              <Text style={styles.exportText}>
                Export Event Summary (CSV)
              </Text>
            </Pressable>
          )}
        </>
      )}
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
    paddingBottom: 60,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 22,
  },
  backText: {
    color: GREEN,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#162c25',
  },
  subtitle: {
    color: '#64748b',
    marginTop: 6,
    marginBottom: 24,
  },
  center: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flexBasis: '40%',
    flexGrow: 1,
    minWidth: 140,
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  statValue: {
    fontSize: 30,
    fontWeight: 'bold',
    color: GREEN,
    marginTop: 8,
  },
  summaryCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: 'bold',
    color: '#162c25',
  },
  bigPercentage: {
    fontSize: 38,
    fontWeight: 'bold',
    color: GREEN,
    marginVertical: 12,
  },
  progressTrack: {
    height: 12,
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: GREEN,
    borderRadius: 10,
  },
  note: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 12,
  },
  eventCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  eventInfo: {
    flex: 1,
    gap: 4,
  },
  eventTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#162c25',
  },
  countBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  countText: {
    color: '#166534',
    fontWeight: 'bold',
    fontSize: 12,
  },
  progressLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  percentage: {
    color: GREEN,
    fontWeight: 'bold',
  },
  muted: {
    color: '#64748b',
    fontSize: 13,
  },
  button: {
    backgroundColor: GREEN,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  exportButton: {
    borderWidth: 1,
    borderColor: GREEN,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  exportText: {
    color: GREEN,
    fontWeight: 'bold',
  },
  errorCard: {
    backgroundColor: '#fee2e2',
    padding: 20,
    borderRadius: 12,
  },
  error: {
    color: '#b91c1c',
    marginBottom: 10,
  },
});
