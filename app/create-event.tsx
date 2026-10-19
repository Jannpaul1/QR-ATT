
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

type Role = 'student' | 'teacher' | 'admin';

const PH_TIMEZONE_OFFSET = '+08:00';

function convertPhilippineTimeToUTC(
  date: string,
  time: string
): Date | null {
  const dateTime = new Date(
    `${date}T${time}:00${PH_TIMEZONE_OFFSET}`
  );

  if (Number.isNaN(dateTime.getTime())) {
    return null;
  }

  // Confirm that the entered date and time are valid
  // after converting back to Philippine time.
  const phParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(dateTime);

  const getPart = (type: string) =>
    phParts.find((part) => part.type === type)?.value;

  const actualDate = [
    getPart('year'),
    getPart('month'),
    getPart('day'),
  ].join('-');

  const actualTime = [
    getPart('hour'),
    getPart('minute'),
  ].join(':');

  if (actualDate !== date || actualTime !== time) {
    return null;
  }

  return dateTime;
}

export default function CreateEventScreen() {
  const router = useRouter();

  const [role, setRole] = useState<Role | null>(null);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    let active = true;

    async function checkAccess() {
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
            'Only teachers and administrators can create events.'
          );
        }

        if (active) {
          setRole(profile.role as Role);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to verify access.'
          );
        }
      } finally {
        if (active) {
          setChecking(false);
        }
      }
    }

    void checkAccess();

    return () => {
      active = false;
    };
  }, []);

  const saveEvent = async () => {
    if (saving) return;

    if (
      !title.trim() ||
      !eventDate.trim() ||
      !startTime.trim() ||
      !endTime.trim()
    ) {
      setError('Please complete the required fields.');
      return;
    }

    const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(eventDate);
    const timeValid = /^([01]\d|2[0-3]):[0-5]\d$/;

    if (
      !dateValid ||
      !timeValid.test(startTime) ||
      !timeValid.test(endTime)
    ) {
      setError(
        'Use YYYY-MM-DD for date and HH:MM for time.'
      );
      return;
    }

    // Always interpret input as Philippine time (UTC+8).
    // This works even when the device uses another timezone.
    const start = convertPhilippineTimeToUTC(
      eventDate,
      startTime
    );

    const end = convertPhilippineTimeToUTC(
      eventDate,
      endTime
    );

    if (!start || !end) {
      setError(
        'Please enter a valid Philippine date and time.'
      );
      return;
    }

    if (end.getTime() <= start.getTime()) {
      setError(
        'End time must be later than start time.'
      );
      return;
    }

    setSaving(true);
    setError('');

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        throw new Error(
          'Your session has expired. Sign in again.'
        );
      }

      // Verify access again before saving.
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
          'Only teachers and administrators can create events.'
        );
      }

      const eventCode =
        'EVT-' +
        Date.now().toString(36).toUpperCase() +
        '-' +
        Math.random()
          .toString(36)
          .slice(2, 8)
          .toUpperCase();

      console.log('CREATING QR-ATT EVENT:', {
        title: title.trim(),
        eventDate,
        startTimePhilippines: startTime,
        endTimePhilippines: endTime,
        startTimeUTC: start.toISOString(),
        endTimeUTC: end.toISOString(),
      });

      const { error: insertError } = await supabase
        .from('events')
        .insert({
          event_code: eventCode,
          title: title.trim(),
          event_date: eventDate,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          venue: venue.trim() || null,
          description: description.trim() || null,
          created_by: auth.user.id,
          status: 'open',
        });

      if (insertError) {
        throw new Error(insertError.message);
      }

      if (typeof window !== 'undefined') {
        window.alert(
          'Event created successfully! The schedule uses Philippine time.'
        );
      } else {
        Alert.alert(
          'Success',
          'Your event has been created successfully.'
        );
      }

      router.back();
    } catch (err) {
      console.error('EVENT CREATION ERROR:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create event.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (checking) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color="#168365"
        />
        <Text>Checking access...</Text>
      </View>
    );
  }

  if (!role) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>

        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>
        Create Event
      </Text>

      <Text style={styles.subtitle}>
        Add a new school event for QR attendance.
        All times are in Philippine Standard Time (UTC+8).
      </Text>

      <Text style={styles.label}>
        Event Title *
      </Text>

      <TextInput
        style={styles.input}
        placeholder="e.g. School Foundation Day"
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.label}>
        Event Date *
      </Text>

      <TextInput
        style={styles.input}
        placeholder="YYYY-MM-DD"
        value={eventDate}
        onChangeText={setEventDate}
        autoCapitalize="none"
      />

      <Text style={styles.label}>
        Start Time * (Philippine Time)
      </Text>

      <TextInput
        style={styles.input}
        placeholder="HH:MM (e.g. 14:20)"
        value={startTime}
        onChangeText={setStartTime}
      />

      <Text style={styles.label}>
        End Time * (Philippine Time)
      </Text>

      <TextInput
        style={styles.input}
        placeholder="HH:MM (e.g. 15:30)"
        value={endTime}
        onChangeText={setEndTime}
      />

      <Text style={styles.label}>
        Venue
      </Text>

      <TextInput
        style={styles.input}
        placeholder="e.g. School Gymnasium"
        value={venue}
        onChangeText={setVenue}
      />

      <Text style={styles.label}>
        Description
      </Text>

      <TextInput
        style={[
          styles.input,
          styles.multiline,
        ]}
        placeholder="Enter event details..."
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
      />

      {error ? (
        <Text style={styles.error}>
          {error}
        </Text>
      ) : null}

      <Pressable
        style={[
          styles.saveButton,
          saving && styles.disabled,
        ]}
        disabled={saving}
        onPress={saveEvent}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveText}>
            Save Event
          </Text>
        )}
      </Pressable>
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
    paddingBottom: 50,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 16,
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
  label: {
    color: '#162c25',
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbe3e8',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    marginBottom: 18,
  },
  multiline: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  error: {
    color: '#dc2626',
    marginBottom: 15,
  },
  saveButton: {
    backgroundColor: '#168365',
    padding: 17,
    borderRadius: 10,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
  saveText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
