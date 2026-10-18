
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

export default function ScanQRScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();

  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const scanLocked = useRef(false);

  const handleScan = useCallback(
    async ({ data }: { data: string }) => {
      if (scanLocked.current) return;

      scanLocked.current = true;
      setProcessing(true);
      setMessage('');
      setSuccess(false);

      try {
        let payload: QRPayload;

        try {
          payload = JSON.parse(data);
        } catch {
          throw new Error('This is not a valid QR-ATT event code.');
        }

        if (
          payload.type !== 'QR_ATT_EVENT' ||
          payload.version !== 1 ||
          typeof payload.event_id !== 'string' ||
          typeof payload.event_code !== 'string'
        ) {
          throw new Error('Invalid QR-ATT event code.');
        }

        const { data: auth, error: authError } =
          await supabase.auth.getUser();

        if (authError || !auth.user) {
          throw new Error('Please sign in to scan attendance.');
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
            'Only student accounts can record attendance.'
          );
        }

        // Verify that the QR event exists and its code matches.
        const { data: event, error: eventError } =
          await supabase
            .from('events')
            .select('id, title, event_code')
            .eq('id', payload.event_id)
            .eq('event_code', payload.event_code)
            .single();

        if (eventError || !event) {
          throw new Error('Event not found or QR code is invalid.');
        }

        // Database RLS enforces student role, event status,
        // and event start/end time. The unique constraint
        // prevents multiple records for one student/event.
        const { error: insertError } = await supabase
          .from('attendance')
          .insert({
            student_id: auth.user.id,
            event_id: event.id,
          });

        if (insertError) {
          if (insertError.code === '23505') {
            throw new Error(
              'You have already recorded attendance for this event.'
            );
          }

          if (insertError.code === '42501') {
            throw new Error(
              'Attendance is not allowed. Check that the event is open and currently in progress.'
            );
          }

          throw new Error(insertError.message);
        }

        setSuccess(true);
        setMessage(
          `Attendance successfully recorded for ${event.title}!`
        );
      } catch (err) {
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
        <Text style={styles.title}>Camera Permission</Text>
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

      <Text style={styles.title}>Scan Event QR Code</Text>
      <Text style={styles.description}>
        Point your camera at the QR code displayed by your teacher.
      </Text>

      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={
            scanLocked.current ? undefined : handleScan
          }
        />
      </View>

      {processing && (
        <View style={styles.status}>
          <ActivityIndicator color="#168365" />
          <Text>Recording attendance...</Text>
        </View>
      )}

      {message ? (
        <View
          style={[
            styles.messageBox,
            success ? styles.successBox : styles.errorBox,
          ]}
        >
          <Text
            style={success ? styles.successText : styles.errorText}
          >
            {message}
          </Text>
        </View>
      ) : null}

      {message && !processing ? (
        <Pressable style={styles.button} onPress={scanAgain}>
          <Text style={styles.buttonText}>Scan Again</Text>
        </Pressable>
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
  messageBox: {
    padding: 16,
    borderRadius: 10,
    marginTop: 20,
  },
  successBox: {
    backgroundColor: '#dcfce7',
  },
  errorBox: {
    backgroundColor: '#fee2e2',
  },
  successText: {
    color: '#166534',
    fontWeight: '600',
    textAlign: 'center',
  },
  errorText: {
    color: '#991b1b',
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
});
