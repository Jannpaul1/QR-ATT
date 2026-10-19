
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getUserRole, type Role } from '@/lib/profiles';

export default function Index() {
  const { user } = useAuth();

  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadRole() {
      setLoading(true);
      setRole(null);

      if (!user) {
        if (active) {
          setLoading(false);
        }
        return;
      }

      try {
        const result = await getUserRole(user.id);

        if (active) {
          setRole(result ?? null);
        }
      } catch (error) {
        console.error('Unable to load role:', error);

        if (active) {
          setRole(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadRole();

    return () => {
      active = false;
    };
  }, [user?.id]);

  const isStudent = role === 'student';
  const isTeacher = role === 'teacher';
  const isAdmin = role === 'admin';

  const openProfile = () => {
    router.push('/profiles');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* HEADER */}
        <View style={styles.headerContainer}>
          <Header title="QR Attendance" />
        </View>

        {/* DASHBOARD TITLE */}
        <View style={styles.bodyContainer}>
          <Text style={styles.mainTitle}>
            {isTeacher
              ? 'Teacher Dashboard'
              : isAdmin
              ? 'Administrator Dashboard'
              : 'School Event Attendance'}
          </Text>

          <Text style={styles.subtitle}>
            {isTeacher
              ? 'Manage school events and monitor student attendance.'
              : isAdmin
              ? 'Manage school events and review attendance records.'
              : 'Scan QR codes to record attendance during school activities.'}
          </Text>
        </View>

        {/* DASHBOARD ACTIONS */}
        <View style={styles.footerContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator
                size="large"
                color={COLORS.primary}
              />

              <Text style={styles.loadingText}>
                Loading your dashboard...
              </Text>
            </View>
          ) : !user || !role ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorTitle}>
                Unable to Verify Account
              </Text>

              <Text style={styles.errorText}>
                We couldn't verify your account role.
                Please check your profile or sign in again.
              </Text>

              <AppButton
                theme="primary"
                title="View Profile"
                icon="person-outline"
                onPress={openProfile}
              />
            </View>
          ) : (
            <>
              {/* STUDENT ACTIONS */}
              {isStudent && (
                <>
                  <AppButton
                    theme="primary"
                    title="Scan QR Code"
                    icon="qr-code-outline"
                    onPress={() => router.push('/scan')}
                  />

                  <AppButton
                    title="Attendance History"
                    icon="time-outline"
                    onPress={() => router.push('/history')}
                  />
                </>
              )}

              {/* TEACHER ACTIONS */}
              {isTeacher && (
                <>
                  <AppButton
                    theme="primary"
                    title="Manage Events"
                    icon="calendar-outline"
                    onPress={() =>
                      router.push('/manage-events')
                    }
                  />

                  <AppButton
                    title="View Attendance"
                    icon="people-outline"
                    onPress={() =>
                      router.push('/attendance-monitoring')
                    }
                  />
                </>
              )}

              {/* ADMINISTRATOR ACTIONS */}
              {isAdmin && (
                <>
                  <AppButton
                    theme="primary"
                    title="Admin Dashboard"
                    icon="shield-checkmark-outline"
                    onPress={() => router.push('/admin')}
                  />

                  <AppButton
                    title="Manage Events"
                    icon="calendar-outline"
                    onPress={() =>
                      router.push('/manage-events')
                    }
                  />

                  <AppButton
                    title="View Attendance"
                    icon="people-outline"
                    onPress={() =>
                      router.push('/attendance-monitoring')
                    }
                  />

                  <AppButton
                    title="Reports & Analytics"
                    icon="bar-chart-outline"
                    onPress={() => router.push('/reports')}
                  />

                  <AppButton
                    title="System Logs"
                    icon="document-text-outline"
                    onPress={() =>
                      router.push('/system-logs')
                    }
                  />
                </>
              )}

              {/* PROFILE BUTTON */}
              <AppButton
                title="Profile"
                icon="person-outline"
                onPress={openProfile}
              />
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 30,
  },

  headerContainer: {
    minHeight: 180,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  bodyContainer: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },

  mainTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 21,
  },

  footerContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    width: '100%',
    gap: 10,
  },

  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },

  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },

  errorContainer: {
    width: '100%',
    alignItems: 'center',
    padding: 20,
    gap: 12,
  },

  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },

  errorText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
});
