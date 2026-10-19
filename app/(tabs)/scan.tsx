
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getUserRole, type Role } from '@/lib/profiles';
import { supabase } from '@/lib/supabase';

type EventQR = {
  type: 'QR_ATT_EVENT';
  version: 1;
  event_id: string;
  event_code: string;
};

type EventRecord = {
  id: string;
  title: string;
  event_code: string;
  status: string;
  start_time: string | null;
  end_time: string | null;
};

const formatPhilippineTime = (date: Date) => {
  return date.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export default function ScanScreen() {
  const [permission, requestPermission] =
    useCameraPermissions();

  const [role, setRole] = useState<Role | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [eventName, setEventName] = useState<string | null>(null);

  const scanLock = useRef(false);
  const { user } = useAuth();

  useEffect(() => {
    let active = true;

    setRoleLoading(true);

    if (!user) {
      setRole(null);
      setRoleLoading(false);
      return;
    }

    getUserRole(user.id)
      .then((userRole) => {
        if (active) setRole(userRole);
      })
      .catch((error) => {
        console.error('Role lookup error:', error);
        if (active) setRole(null);
      })
      .finally(() => {
        if (active) setRoleLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  const handleBarcodeScanned = async ({
    data,
  }: {
    data: string;
  }) => {
    if (scanLock.current) return;

    scanLock.current = true;
    setScanned(true);
    setProcessing(true);
    setMessage(null);
    setSuccess(false);
    setEventName(null);

    try {
      // STEP 1: Check signed-in account
      if (!user) {
        throw new Error('Please log in first.');
      }

      if (role !== 'student') {
        throw new Error(
          'Only students can record attendance.'
        );
      }

      // STEP 2: Validate QR code
      let qr: EventQR;

      try {
        qr = JSON.parse(data);
      } catch {
        throw new Error('Invalid QR code format.');
      }

      if (
        !qr ||
        qr.type !== 'QR_ATT_EVENT' ||
        qr.version !== 1 ||
        typeof qr.event_id !== 'string' ||
        typeof qr.event_code !== 'string' ||
        !qr.event_id.trim() ||
        !qr.event_code.trim()
      ) {
        throw new Error(
          'This is not a valid QR-ATT event QR code.'
        );
      }

      console.log('SCANNED QR:', {
        eventId: qr.event_id,
        eventCode: qr.event_code,
      });

      // STEP 3: Find event in Supabase
      const { data: eventData, error: eventError } =
        await supabase
          .from('events')
          .select(
            'id, title, event_code, status, start_time, end_time'
          )
          .eq('id', qr.event_id)
          .eq('event_code', qr.event_code)
          .single();

      if (eventError || !eventData) {
        console.error('Event lookup error:', eventError);
        throw new Error(
          'Event not found or QR code is invalid.'
        );
      }

      const event = eventData as EventRecord;

      setEventName(event.title);

      // STEP 4: Check event status
      if (event.status?.toLowerCase() !== 'open') {
        throw new Error(
          `Attendance for ${event.title} is closed.`
        );
      }

      // STEP 5: Validate attendance schedule
      const now = Date.now();

      const start = event.start_time
        ? new Date(event.start_time).getTime()
        : NaN;

      const end = event.end_time
        ? new Date(event.end_time).getTime()
        : NaN;

      console.log('QR-ATT EVENT DEBUG:', {
        title: event.title,
        eventCode: event.event_code,
        startTimeFromDatabase: event.start_time,
        endTimeFromDatabase: event.end_time,
        currentTimeUTC: new Date(now).toISOString(),
        startTimePhilippines: Number.isFinite(start)
          ? formatPhilippineTime(new Date(start))
          : 'Invalid',
        endTimePhilippines: Number.isFinite(end)
          ? formatPhilippineTime(new Date(end))
          : 'Invalid',
      });

      if (
        !Number.isFinite(start) ||
        !Number.isFinite(end)
      ) {
        throw new Error(
          'This event has an invalid attendance schedule.'
        );
      }

      if (now < start) {
        throw new Error(
          `Attendance has not started yet for ${event.title}. ` +
          `Start time: ${formatPhilippineTime(new Date(start))}. ` +
          `Current time: ${formatPhilippineTime(new Date(now))}.`
        );
      }

      if (now > end) {
        throw new Error(
          `Attendance has already ended for ${event.title}. ` +
          `End time: ${formatPhilippineTime(new Date(end))}.`
        );
      }

      // STEP 6: Check existing attendance
      const { data: existing, error: existingError } =
        await supabase
          .from('attendance')
          .select('id')
          .eq('student_id', user.id)
          .eq('event_id', event.id)
          .maybeSingle();

      if (existingError) {
        console.error(
          'Attendance lookup error:',
          existingError
        );

        throw new Error(
          'Unable to check existing attendance: ' +
          existingError.message
        );
      }

      if (existing) {
        throw new Error(
          'You have already recorded attendance for this event.'
        );
      }

      // STEP 7: Record attendance
      const { error: insertError } = await supabase
        .from('attendance')
        .insert({
          student_id: user.id,
          event_id: event.id,
        });

      if (insertError) {
        console.error(
          'Attendance insert error:',
          insertError
        );

        if (insertError.code === '23505') {
          throw new Error(
            'You have already recorded attendance for this event.'
          );
        }

        if (insertError.code === '42501') {
          throw new Error(
            'Attendance was denied by the database. ' +
            'Check the event schedule, student role, and attendance permissions.'
          );
        }

        throw new Error(
          'Unable to record attendance: ' +
          insertError.message
        );
      }

      // STEP 8: Success
      setSuccess(true);
      setMessage(
        `Attendance successfully recorded for ${event.title}!`
      );
    } catch (error) {
      console.error('QR-ATT SCAN ERROR:', error);

      setSuccess(false);
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to record attendance.'
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleScanAgain = () => {
    scanLock.current = false;
    setScanned(false);
    setProcessing(false);
    setMessage(null);
    setSuccess(false);
    setEventName(null);
  };

  if (roleLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />
        <Text style={styles.loadingText}>
          Checking your account...
        </Text>
      </View>
    );
  }

  if (!user || role !== 'student') {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.title}>
          Students Only
        </Text>
        <Text style={styles.subtitle}>
          Please sign in with a student account to scan
          attendance QR codes.
        </Text>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator
          color={COLORS.primary}
        />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.title}>
          Camera Permission Needed
        </Text>

        <Text style={styles.subtitle}>
          Allow camera access to scan event QR codes.
        </Text>

        <AppButton
          theme="primary"
          title="Grant Permission"
          icon="camera"
          onPress={requestPermission}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={
          scanned ? undefined : handleBarcodeScanned
        }
      />

      <View style={styles.overlay}>
        <Text style={styles.overlayText}>
          {processing
            ? 'Recording attendance...'
            : scanned
            ? 'QR Code Detected'
            : 'Point your camera at an event QR code'}
        </Text>

        {eventName && (
          <Text style={styles.eventName}>
            {eventName}
          </Text>
        )}

        {processing && (
          <ActivityIndicator
            color={COLORS.primary}
            style={{ marginVertical: 12 }}
          />
        )}

        {message && (
          <Text
            style={[
              styles.scanResult,
              success ? styles.success : styles.error,
            ]}
          >
            {message}
          </Text>
        )}

        {scanned && !processing && (
          <AppButton
            theme="primary"
            title="Scan Again"
            icon="refresh"
            onPress={handleScanAgain}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  camera: {
    ...StyleSheet.absoluteFill,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  eventName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  overlay: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 60,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  overlayText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  scanResult: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '600',
  },
  success: {
    color: '#2E7D32',
  },
  error: {
    color: '#C62828',
  },
});
