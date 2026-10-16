
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getUserRole, type Role } from '@/lib/profiles';

export default function TabLayout() {
  const { user } = useAuth();

  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadRole() {
      setLoading(true);
      setRole(null);

      if (!user) {
        if (active) setLoading(false);
        return;
      }

      const result = await getUserRole(user.id);

      if (active) {
        setRole(result);
        setLoading(false);
      }
    }

    loadRole();

    return () => {
      active = false;
    };
  }, [user?.id]);

  const isAdmin = role === 'admin';
  const isTeacher = role === 'teacher';
  const isStudent = role === 'student';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,

        headerStyle: {
          backgroundColor: COLORS.card,
        },
        headerShadowVisible: false,
        headerTintColor: COLORS.textPrimary,

        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              color={color}
              size={23}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          href: !loading && isStudent ? undefined : null,
          tabBarIcon: ({ color }) => (
            <Ionicons
              name="qr-code-outline"
              color={color}
              size={23}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          href:
            !loading && (isStudent || isTeacher)
              ? undefined
              : null,
          tabBarIcon: ({ color }) => (
            <Ionicons
              name="time-outline"
              color={color}
              size={23}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="teacher"
        options={{
          title: 'Events',
          href: !loading && isTeacher ? undefined : null,
          tabBarIcon: ({ color }) => (
            <Ionicons
              name="calendar-outline"
              color={color}
              size={23}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          href: !loading && isAdmin ? undefined : null,
          tabBarIcon: ({ color }) => (
            <Ionicons
              name="shield-checkmark-outline"
              color={color}
              size={23}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profiles"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              color={color}
              size={23}
            />
          ),
        }}
      />
    </Tabs>
  );
}
