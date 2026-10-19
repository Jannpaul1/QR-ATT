
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

type QRPayload = {
  type: string;
  version: number;
  event_id: string;
  event_code: string;
};

type EventData = {
  id: string;
  title: string;
  event_code: string;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string | null;
};

export default function ScanQRScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();

  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [eventName, setEventName] = useState('');

  const scanLocked = useRef(false);

  const handleScan = useCallback(
    async ({ data }: { data: string }) => {
      if (scanLocked.current) return;

      scanLocked.current = true;
      setProcessing(true);
      setMessage('');
      setSuccess(false);
      setEventName('');

      console.log('QR CODE DETECTED:', data);

      try {
        // STEP 1: Validate QR code format
        let payload: QRPayload;

        try {
          payload = JSON.parse(data);
        } catch {
          throw new Error(
            'Invalid QR code. Please scan a QR-ATT event code.'
          );
        }

        if (
          payload === null ||
          typeof payload !== 'object' ||
          payload.type !== 'QR_ATT_EVENT' ||
          payload.version !== 1 ||
          typeof payload.event_id !== 'string' ||
          typeof payload.event_code !== 'string' ||
          !payload.event_id.trim() ||
          !payload.event_code.trim()
        ) {
          throw new Error('Invalid QR-ATT event code.');
        }

        // STEP 2: Verify signed-in user
        const { data: auth, error: authError } =
          await supabase.auth.getUser();

        if (authError || !auth.user) {
          throw new Error(
            'Please sign in to your student account first.'
          );
        }

        console.log('Authenticated user:', auth.user.id);

        // STEP 3: Verify student role
        const { data: profile, error: profileError } =
          await supabase
            .from('profiles')
            .select('role')
            .eq('id', auth.user.id)
            .single();

        if (profileError) {
          throw new Error(
            'Unable to verify your account: ' +
              profileError.message
          );
        }

        if (profile?.role !== 'student') {
          throw new Error(
            'Only student accounts can record attendance.'
          );
        }

        // STEP 4: Verify event and QR code
        const { data: event, error: eventError } =
          await supabase
            .from('events')
            .select(
              'id, title, event_code, event_date, start_time, end_time, status'
            )
            .eq('id', payload.event_id)
            .eq('event_code', payload.event_code)
            .single();

        if (eventError || !event) {
          console.error('Event lookup error:', eventError);

          throw new Error(
            'Event not found. Please scan a valid event QR code.'
          );
        }

        const currentEvent = event as EventData;
        setEventName(currentEvent.title);

        console.log('EVENT FOUND:', currentEvent.title);

        // STEP 5: Validate event status
        if (currentEvent.status?.toLowerCase() !== 'open') {
          throw new Error(
            'Attendance is closed for this event.'
          );
        }

        // STEP 6: Validate event date and time
        const now = new Date();

        if (currentEvent.event_date) {
          const today = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, '0'),
            String(now.getDate()).padStart(2, '0'),
          ].join('-');

          if (currentEvent.event_date !== today) {
            throw new Error(
              'Attendance is only available on the event date.'
            );
          }
        }

        if (currentEvent.start_time) {
          const start = new Date(currentEvent.start_time);

          if (
            !Number.isNaN(start.getTime()) &&
            now < start
          ) {
            throw new Error(
              'Attendance has not started for this event.'
            );
          }
        }

        if (currentEvent.end_time) {
          const end = new Date(currentEvent.end_time);

          if (
            !Number.isNaN(end.getTime()) &&
            now > end
          ) {
            throw new Error(
              'Attendance has already ended for this event.'
            );
          }
        }

        // STEP 7: Check existing attendance
        const { data: existing, error: existingError } =
          await supabase
            .from('attendance')
            .select('id')
            .eq('student_id', auth.user.id)
            .eq('event_id', currentEvent.id)
            .maybeSingle();

        if (existingError) {
          throw new Error(
            'Unable to check attendance: ' +
              existingError.message
          );
        }

        if (existing) {
          throw new Error(
            'You have already recorded attendance for this event.'
          );
        }

        // STEP 8: Save attendance to Supabase
        console.log('SAVING ATTENDANCE...');

        const { error: insertError } = await supabase
          .from('attendance')
          .insert({
            student_id: auth.user.id,
            event_id: currentEvent.id,
          });

        console.log(
          'ATTENDANCE INSERT ERROR:',
          insertError
        );

        if (insertError) {
          if (insertError.code === '23505') {
            throw new Error(
              'You have already recorded attendance for this event.'
            );
          }

          if (insertError.code === '42501') {
            throw new Error(
              'Supabase denied attendance. Check the event schedule and database permissions.'
            );
          }

          throw new Error(
            'Unable to save attendance: ' +
              insertError.message
          );
        }

        // STEP 9: Show success
        console.log('ATTENDANCE SAVED SUCCESSFULLY');

        setSuccess(true);
        setMessage(
          'Your attendance has been recorded successfully!'
        );
      } catch (err) {
        console.error('QR-ATT SCAN ERROR:', err);

        setSuccess(false);
        setMessage(
          err instanceof Error
            ? err.message
            : 'Unable to record attendance.'
        );
      } finally {
        setProcessing(false);
      }
    },
    []
  );

  const scanAgain = () => {
    scanLocked.current = false;
    setMessage('');
    setSuccess(false);
    setEventName('');
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#168365" />
        <Text>Checking camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>
          Camera Permission Required
        </Text>

        <Text style={styles.description}>
          QR-ATT needs camera access to scan school event QR codes.
        </Text>

        <Pressable
          style={styles.button}
          onPress={() => void requestPermission()}
        >
          <Text style={styles.buttonText}>
            Allow Camera Access
          </Text>
        </Pressable>

        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Go Back</Text>
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
        Scan Event QR Code
      </Text>

      <Text style={styles.description}>
        Point your camera at the event QR code displayed by your teacher.
      </Text>

      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={
            processing || message
              ? undefined
              : handleScan
          }
        />
      </View>

      {processing && (
        <View style={styles.status}>
          <ActivityIndicator
            size="large"
            color="#168365"
          />

          <Text style={styles.muted}>
            Verifying event and recording attendance...
          </Text>
        </View>
      )}

      {message ? (
        <View
          style={[
            styles.messageBox,
            success
              ? styles.successBox
              : styles.errorBox,
          ]}
        >
          <Text
            style={[
              styles.messageTitle,
              success
                ? styles.successText
                : styles.errorText,
            ]}
          >
            {success
              ? 'Attendance Recorded!'
              : 'Attendance Not Recorded'}
          </Text>

          {eventName ? (
            <Text style={styles.eventName}>
              {eventName}
            </Text>
          ) : null}

          <Text
            style={
              success
                ? styles.successText
                : styles.errorText
            }
          >
            {message}
          </Text>
        </View>
      ) : null}

      {message && !processing ? (
        <>
          {success && (
            <Pressable
              style={styles.button}
              onPress={() =>
                router.push('/attendance-history')
              }
            >
              <Text style={styles.buttonText}>
                View Attendance History
              </Text>
            </Pressable>
          )}

          <Pressable
            style={styles.secondaryButton}
            onPress={scanAgain}
          >
            <Text style={styles.secondaryText}>
              Scan Again
            </Text>
          </Pressable>
        </>
      ) : null}
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 18,
    backgroundColor: '#f5f7f6',
  },
  back: {
    color: '#168365',
    fontWeight: '600',
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#162c25',
    marginBottom: 10,
  },
  description: {
    color: '#64748b',
    lineHeight: 22,
    marginBottom: 22,
    textAlign: 'center',
  },
  cameraContainer: {
    height: 340,
    width: '100%',
    maxWidth: 450,
    alignSelf: 'center',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  status: {
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
  },
  muted: {
    color: '#64748b',
    textAlign: 'center',
  },
  messageBox: {
    padding: 20,
    borderRadius: 12,
    marginTop: 20,
    alignItems: 'center',
    gap: 10,
  },
  messageTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  successBox: {
    backgroundColor: '#dcfce7',
  },
  errorBox: {
    backgroundColor: '#fee2e2',
  },
  successText: {
    color: '#166534',
    textAlign: 'center',
  },
  errorText: {
    color: '#991b1b',
    textAlign: 'center',
  },
  eventName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#162c25',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#168365',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#168365',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryText: {
    color: '#168365',
    fontWeight: 'bold',
  },
});
