
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '@/lib/supabase';

type EventInfo = {
  id: string;
  title: string;
  event_code: string;
  event_date: string | null;
  venue: string | null;
  created_by: string | null;
};

export default function EventQRScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [event, setEvent] = useState<EventInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadEvent() {
      try {
        if (!id || typeof id !== 'string') {
          throw new Error('Missing event ID.');
        }

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
            'Only teachers and administrators can display event QR codes.'
          );
        }

        const { data, error: eventError } = await supabase
          .from('events')
          .select(
            'id, title, event_code, event_date, venue, created_by'
          )
          .eq('id', id)
          .single();

        if (eventError) {
          throw new Error(eventError.message);
        }

        if (
          profile.role === 'teacher' &&
          data.created_by !== auth.user.id
        ) {
          throw new Error(
            'You can only display QR codes for your own events.'
          );
        }

        if (active) setEvent(data as EventInfo);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load event.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadEvent();

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#168365" />
        <Text>Loading event QR code...</Text>
      </View>
    );
  }

  if (error || !event) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>
          {error || 'Event not found.'}
        </Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const qrPayload = JSON.stringify({
    type: 'QR_ATT_EVENT',
    version: 1,
    event_id: event.id,
    event_code: event.event_code,
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Back to Events</Text>
      </Pressable>

      <Text style={styles.heading}>Event QR Code</Text>
      <Text style={styles.subtitle}>
        Display this code for students to scan.
      </Text>

      <View style={styles.card}>
        <Text style={styles.eventTitle}>{event.title}</Text>

        <Text style={styles.detail}>
          Date: {event.event_date || 'Not specified'}
        </Text>

        <Text style={styles.detail}>
          Venue: {event.venue || 'Not specified'}
        </Text>

        <View style={styles.qrContainer}>
          <QRCode
            value={qrPayload}
            size={240}
            color="#162c25"
            backgroundColor="#ffffff"
          />
        </View>

        <Text style={styles.codeLabel}>EVENT CODE</Text>
        <Text selectable style={styles.code}>
          {event.event_code}
        </Text>

        <Text style={styles.instruction}>
          Students will use the QR-ATT scanner to scan
          this code during the event.
        </Text>
      </View>

      <Text style={styles.note}>
        QR generation is ready. Attendance recording
        and validation will be added in the next steps.
      </Text>
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
    alignItems: 'center',
    paddingBottom: 50,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  back: {
    color: '#168365',
    fontWeight: '600',
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#162c25',
    alignSelf: 'flex-start',
  },
  subtitle: {
    color: '#64748b',
    marginTop: 6,
    marginBottom: 22,
    alignSelf: 'flex-start',
  },
  card: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  eventTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#162c25',
    textAlign: 'center',
    marginBottom: 12,
  },
  detail: {
    color: '#64748b',
    marginBottom: 6,
    textAlign: 'center',
  },
  qrContainer: {
    padding: 18,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginVertical: 22,
  },
  codeLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: 'bold',
  },
  code: {
    color: '#168365',
    fontSize: 17,
    fontWeight: 'bold',
    marginTop: 8,
    textAlign: 'center',
  },
  instruction: {
    color: '#64748b',
    marginTop: 20,
    textAlign: 'center',
    lineHeight: 21,
  },
  note: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 20,
    maxWidth: 450,
  },
  error: {
    color: '#dc2626',
    textAlign: 'center',
  },
});
    