
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getUserRole, type Role } from '@/lib/profiles';
import {
  getAttendanceHistory,
  getTeacherEventAttendance,
  type AttendanceRecord,
  type TeacherEventAttendance,
} from '@/lib/attendance';

export default function HistoryScreen() {
  const [role, setRole] = useState<Role | null>(null);

  const [studentRecords, setStudentRecords] = useState<
    AttendanceRecord[]
  >([]);

  const [teacherEvents, setTeacherEvents] = useState<
    TeacherEventAttendance[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { user } = useAuth();

  const loadHistory = useCallback(async () => {
    if (!user) {
      setRole(null);
      setStudentRecords([]);
      setTeacherEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const currentRole = await getUserRole(user.id);

      if (!currentRole) {
        throw new Error('Unable to verify your account role.');
      }

      setRole(currentRole);

      if (currentRole === 'teacher') {
        const events = await getTeacherEventAttendance(
          user.id
        );

        setTeacherEvents(events);
        setStudentRecords([]);
      } else if (currentRole === 'student') {
        const records = await getAttendanceHistory(
          user.id
        );

        setStudentRecords(records);
        setTeacherEvents([]);
      } else {
        setStudentRecords([]);
        setTeacherEvents([]);
      }
    } catch (err) {
      console.error('History loading error:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load attendance history.'
      );

      setStudentRecords([]);
      setTeacherEvents([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />

        <Text style={styles.subtitle}>
          Loading attendance records...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>
          {error}
        </Text>
      </View>
    );
  }

  if (role === 'teacher') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>
          Attendance History
        </Text>

        <Text style={styles.timezoneNote}>
          All times are shown in Philippine Time (PHT).
        </Text>

        {teacherEvents.length === 0 ? (
          <Text style={styles.subtitle}>
            No events yet. Create an event to see
            attendance here.
          </Text>
        ) : (
          <FlatList
            data={teacherEvents}
            keyExtractor={(item) => item.eventId}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.headerRow}>
                  <Text style={styles.eventTitle}>
                    {item.title}
                  </Text>

                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>
                      {item.attendeeCount}
                    </Text>
                  </View>
                </View>

                <Text style={styles.eventMeta}>
                  Code: {item.eventCode}
                </Text>

                {item.startTime && (
                  <Text style={styles.eventMeta}>
                    Start: {formatDate(item.startTime)}
                  </Text>
                )}

                <Text style={styles.attendeesTitle}>
                  Students ({item.attendeeCount})
                </Text>

                {item.attendees.length === 0 ? (
                  <Text style={styles.noAttendees}>
                    No students have scanned yet.
                  </Text>
                ) : (
                  item.attendees.map((attendee) => (
                    <View
                      key={`${attendee.studentId}-${attendee.scannedAt}`}
                      style={styles.attendeeRow}
                    >
                      <View style={styles.attendeeInfo}>
                        <Text style={styles.studentId}>
                          Student: {shortId(attendee.studentId)}
                        </Text>

                        <Text style={styles.scanTime}>
                          Scanned: {formatDate(attendee.scannedAt)}
                        </Text>
                      </View>

                      <View style={styles.presentBadge}>
                        <Text style={styles.presentText}>
                          Present
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
          />
        )}
      </View>
    );
  }

  if (role === 'admin') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>
          Attendance History
        </Text>

        <Text style={styles.subtitle}>
          Administrators can review attendance through
          Attendance Monitoring and Reports.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        My Attendance History
      </Text>

      <Text style={styles.timezoneNote}>
        All times are shown in Philippine Time (PHT).
      </Text>

      {studentRecords.length === 0 ? (
        <Text style={styles.subtitle}>
          No records yet. Scan an event QR code to
          register your attendance.
        </Text>
      ) : (
        <FlatList
          data={studentRecords}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.headerRow}>
                <Text style={styles.eventTitle}>
                  {item.eventTitle}
                </Text>

                <View style={styles.presentBadge}>
                  <Text style={styles.presentText}>
                    Present
                  </Text>
                </View>
              </View>

              <Text style={styles.eventMeta}>
                {item.eventId}
              </Text>

              <Text style={styles.dateLabel}>
                Attendance Recorded
              </Text>

              <Text style={styles.dateValue}>
                {formatDate(item.scannedAt)}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

function shortId(id: string) {
  return id ? `…${id.slice(-8)}` : 'unknown';
}

function formatDate(iso: string) {
  if (!iso) return 'Not available';

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }

  return date.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }) + ' PHT';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
    paddingTop: 24,
  },

  center: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },

  timezoneNote: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 18,
  },

  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 24,
  },

  error: {
    fontSize: 14,
    color: '#DC2626',
    textAlign: 'center',
  },

  list: {
    paddingBottom: 30,
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  eventTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginRight: 12,
  },

  eventMeta: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 3,
  },

  dateLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 12,
    marginBottom: 3,
  },

  dateValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },

  presentBadge: {
    backgroundColor: '#DCFCE7',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  presentText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '700',
  },

  countBadge: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },

  countText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  attendeesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },

  attendeeRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  attendeeInfo: {
    flex: 1,
  },

  studentId: {
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },

  scanTime: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  noAttendees: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
});
