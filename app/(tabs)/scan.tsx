import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { registerAttendance } from '@/lib/attendance';
import { getUserRole, type Role } from '@/lib/profiles';

export default function ScanScreen() {
  const [permission, requestPermission] =
    useCameraPermissions();

  const [role, setRole] = useState<Role | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  const [scanned, setScanned] = useState(false);
  const [lastData, setLastData] =
    useState<string | null>(null);
  const [message, setMessage] =
    useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { user } = useAuth();

  // Check the logged-in user's role
  useEffect(() => {
    let active = true;

    setRoleLoading(true);

    if (!user) {
      setRole(null);
      setRoleLoading(false);

      return () => {
        active = false;
      };
    }

    getUserRole(user.id).then((userRole) => {
      if (!active) return;

      setRole(userRole ?? 'student');
      setRoleLoading(false);
    });

    return () => {
      active = false;
    };
  }, [user]);

  // Loading role
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

  // Teacher restriction
  if (role !== 'student') {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.title}>
          Students Only
        </Text>

        <Text style={styles.subtitle}>
          Only student accounts can scan attendance QR codes.
        </Text>
      </View>
    );
  }

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>
          Camera Permission Needed
        </Text>

        <Text style={styles.subtitle}>
          We need access to your camera to scan QR codes.
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

  const handleBarcodeScanned = ({
    data,
  }: {
    data: string;
  }) => {
    console.log('SCANNED QR DATA:', data);

    setScanned(true);
    setLastData(data);
    setMessage(null);

    const studentId = user?.id;

    if (!studentId) {
      setSuccess(false);
      setMessage(
        'You must be logged in to record attendance.'
      );
      return;
    }

    registerAttendance(data, studentId).then(
      (result) => {
        setSuccess(result.success);
        setMessage(result.message);
      }
    );
  };

  const handleScanAgain = () => {
    setScanned(false);
    setLastData(null);
    setMessage(null);
    setSuccess(false);
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={
          scanned
            ? undefined
            : handleBarcodeScanned
        }
      />

      <View style={styles.overlay}>
        <Text style={styles.overlayText}>
          {scanned
            ? 'QR Code detected!'
            : 'Point your camera at a QR code'}
        </Text>

        {scanned && message && (
          <Text
            style={[
              styles.scanResult,
              success
                ? styles.success
                : styles.error,
            ]}
          >
            {message}
          </Text>
        )}

        {scanned && lastData && (
          <Text style={styles.scanData}>
            {lastData}
          </Text>
        )}

        {scanned && (
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
    marginBottom: 6,
    textAlign: 'center',
  },

  scanResult: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '600',
  },

  success: {
    color: '#2E7D32',
  },

  error: {
    color: '#C62828',
  },

  scanData: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
  },
});
