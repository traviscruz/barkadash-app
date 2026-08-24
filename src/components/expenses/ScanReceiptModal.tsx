import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import {
  Camera,
  ChevronLeft,
  ImageIcon,
  RefreshCw,
  RotateCcw,
  Scan,
  X,
  Zap,
  ZapOff,
} from 'lucide-react-native';
import { ReceiptScanResult, scanReceiptImage } from '../../services/receiptScanService';
import { useTheme } from '../../context/ThemeContext';

interface ScanReceiptModalProps {
  visible: boolean;
  onClose: () => void;
  onCaptured: (uri: string, result: ReceiptScanResult) => void;
}

const MinimalCorner: React.FC<{
  position: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
}> = ({ position }) => {
  const stylesMap = {
    topLeft: { top: -1, left: -1, borderTopLeftRadius: 12, borderTopWidth: 3, borderLeftWidth: 3 },
    topRight: { top: -1, right: -1, borderTopRightRadius: 12, borderTopWidth: 3, borderRightWidth: 3 },
    bottomLeft: { bottom: -1, left: -1, borderBottomLeftRadius: 12, borderBottomWidth: 3, borderLeftWidth: 3 },
    bottomRight: { bottom: -1, right: -1, borderBottomRightRadius: 12, borderBottomWidth: 3, borderRightWidth: 3 },
  };

  return <View style={[styles.corner, stylesMap[position]]} />;
};

export const ScanReceiptModal: React.FC<ScanReceiptModalProps> = ({
  visible,
  onClose,
  onCaptured,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<any>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [scanning, setScanning] = useState(false);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [error, setError] = useState('');

  const screenW = Dimensions.get('window').width;
  const frameW = Math.min(screenW - 64, 320);
  const frameH = Math.min(frameW * 1.44, 460);

  // Animated white laser line
  const laserAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && scanning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(laserAnim, {
            toValue: 1,
            duration: 1600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(laserAnim, {
            toValue: 0,
            duration: 1600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      laserAnim.setValue(0);
    }
  }, [visible, scanning, laserAnim]);

  // Reset state when closing
  const handleClose = () => {
    setCapturedUri(null);
    setScanning(false);
    setError('');
    onClose();
  };

  // Process and scan frozen receipt image
  const processImageUri = async (uri: string) => {
    setError('');
    setCapturedUri(uri); // Freezes the preview on screen
    setScanning(true);

    try {
      let result: ReceiptScanResult = {};
      try {
        result = await scanReceiptImage(uri);
      } catch (scanError) {
        console.warn('OCR scan error, proceeding with photo draft:', scanError);
      }
      onCaptured(uri, result);
    } catch (e) {
      console.warn('Receipt processing error:', e);
      setError('Could not read receipt. Tap retry to try again.');
    } finally {
      setScanning(false);
    }
  };

  const handleCapture = async () => {
    if (!cameraRef.current || scanning || capturedUri) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });
      if (photo?.uri) {
        await processImageUri(photo.uri);
      }
    } catch (e) {
      console.warn('Capture failed:', e);
      setError('Camera capture failed. Please try again.');
    }
  };

  const handlePickFromGallery = async () => {
    if (scanning) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setError('Photo library access was denied.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        await processImageUri(result.assets[0].uri);
      }
    } catch (e) {
      console.warn('Gallery pick failed:', e);
    }
  };

  const handleResetFreeze = () => {
    setCapturedUri(null);
    setError('');
    setScanning(false);
  };

  if (!visible) return null;

  // Minimalist Permission Screen (Monochrome & White)
  if (!permission || !permission.granted) {
    return (
      <Modal
        visible={visible}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={handleClose}
      >
        <View
          style={[
            styles.permissionContainer,
            {
              backgroundColor: '#050505',
              paddingTop: insets.top + 16,
              paddingBottom: insets.bottom + 24,
            },
          ]}
        >
          <View style={styles.permissionTopRow}>
            <TouchableOpacity
              onPress={handleClose}
              activeOpacity={0.8}
              style={styles.circleIconButton}
            >
              <ChevronLeft size={20} color="#FFFFFF" strokeWidth={2.4} />
            </TouchableOpacity>
            <View style={styles.pillHeader}>
              <Text style={styles.pillHeaderText}>CAMERA ACCESS</Text>
            </View>
            <View style={{ width: 44 }} />
          </View>

          <View style={styles.permissionCenter}>
            <View style={styles.permissionIconCircle}>
              <Scan size={34} color="#FFFFFF" strokeWidth={1.8} />
            </View>

            <Text style={styles.permissionHeading}>Receipt Scanner</Text>
            <Text style={styles.permissionText}>
              Scan receipts to automatically extract expense totals and item details for your group ledger.
            </Text>

            {permission && !permission.granted && (
              <TouchableOpacity
                onPress={requestPermission}
                activeOpacity={0.85}
                style={styles.pillWhiteButton}
              >
                <Camera size={18} color="#000000" strokeWidth={2.2} />
                <Text style={styles.pillWhiteButtonText}>Enable Camera</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={handlePickFromGallery}
              activeOpacity={0.85}
              style={styles.pillOutlineButton}
            >
              <ImageIcon size={18} color="#FFFFFF" strokeWidth={2.2} />
              <Text style={styles.pillOutlineButtonText}>Upload from Gallery</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.permissionFootnote}>
            Everything remains editable before saving to the ledger.
          </Text>
        </View>
      </Modal>
    );
  }

  const translateY = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, frameH - 3],
  });

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View style={styles.screen}>
        {/* Live Camera Viewfinder OR Frozen Captured Image */}
        {capturedUri ? (
          <Image
            source={{ uri: capturedUri }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
        ) : (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            enableTorch={torch}
            mode="picture"
            autofocus="on"
          />
        )}

        {/* Minimalist Dark Overlay */}
        <View pointerEvents="none" style={styles.darkOverlay} />

        {/* Top Circle & Pill Header */}
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          {/* Circular Close Button */}
          <TouchableOpacity
            onPress={handleClose}
            activeOpacity={0.75}
            style={styles.circleIconButton}
          >
            <X size={20} color="#FFFFFF" strokeWidth={2.4} />
          </TouchableOpacity>

          {/* Pill Title */}
          <View style={styles.pillHeader}>
            <Text style={styles.pillHeaderText}>SCAN RECEIPT</Text>
          </View>

          {/* Circular Torch Button (disabled when frozen) */}
          <TouchableOpacity
            onPress={() => setTorch((v) => !v)}
            activeOpacity={0.75}
            disabled={!!capturedUri}
            style={[
              styles.circleIconButton,
              torch && !capturedUri && styles.circleIconButtonActive,
              capturedUri && { opacity: 0.3 },
            ]}
          >
            {torch ? (
              <Zap size={19} color="#FFFFFF" strokeWidth={2.4} />
            ) : (
              <ZapOff size={19} color="#FFFFFF" strokeWidth={2.4} />
            )}
          </TouchableOpacity>
        </View>

        {/* Viewfinder Frame with Minimalist White Hairline Corners */}
        <View pointerEvents="none" style={styles.viewfinderCenter}>
          <View style={[styles.frame, { width: frameW, height: frameH }]}>
            <MinimalCorner position="topLeft" />
            <MinimalCorner position="topRight" />
            <MinimalCorner position="bottomLeft" />
            <MinimalCorner position="bottomRight" />

            {/* Crisp white scanning laser line */}
            {scanning && (
              <Animated.View
                style={[
                  styles.laserLine,
                  {
                    width: frameW - 12,
                    transform: [{ translateY }],
                  },
                ]}
              />
            )}
          </View>

          {/* Single Minimalist Status / Guidance Pill */}
          <View style={styles.guidancePill}>
            {scanning ? (
              <>
                <ActivityIndicator size="small" color="#FFFFFF" style={{ transform: [{ scale: 0.8 }] }} />
                <Text style={styles.guidancePillText}>Scanning…</Text>
              </>
            ) : error ? (
              <Text style={[styles.guidancePillText, { color: '#FFFFFF' }]}>{error}</Text>
            ) : (
              <Text style={styles.guidancePillText}>Align receipt in frame</Text>
            )}
          </View>
        </View>

        {/* Bottom Minimalist Controls Dock */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 26 }]}>
          {/* Circular Photo Gallery Button */}
          <TouchableOpacity
            onPress={handlePickFromGallery}
            activeOpacity={0.8}
            disabled={scanning}
            style={styles.circleDockButton}
          >
            <ImageIcon size={22} color="#FFFFFF" strokeWidth={2.2} />
          </TouchableOpacity>

          {/* Center Minimalist Shutter Button OR Retry Button if frozen with error */}
          {capturedUri && error ? (
            <TouchableOpacity
              onPress={handleResetFreeze}
              activeOpacity={0.85}
              style={styles.shutterOuterCircle}
            >
              <View style={styles.shutterInnerCircle}>
                <RotateCcw size={24} color="#000000" strokeWidth={2.4} />
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleCapture}
              activeOpacity={0.85}
              disabled={scanning || !!capturedUri}
              style={[styles.shutterOuterCircle, capturedUri && { opacity: 0.6 }]}
            >
              <View style={styles.shutterInnerCircle}>
                {scanning && <ActivityIndicator size="small" color="#000000" />}
              </View>
            </TouchableOpacity>
          )}

          {/* Circular Camera Flip Button OR Retake Button */}
          {capturedUri ? (
            <TouchableOpacity
              onPress={handleResetFreeze}
              activeOpacity={0.8}
              disabled={scanning}
              style={styles.circleDockButton}
            >
              <RotateCcw size={21} color="#FFFFFF" strokeWidth={2.2} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
              activeOpacity={0.8}
              disabled={scanning}
              style={styles.circleDockButton}
            >
              <RefreshCw size={21} color="#FFFFFF" strokeWidth={2.2} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.46)',
  },
  topBar: {
    position: 'absolute',
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  circleIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  circleIconButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderColor: '#FFFFFF',
  },
  pillHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  pillHeaderText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  viewfinderCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  frame: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    position: 'relative',
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#FFFFFF',
  },
  laserLine: {
    position: 'absolute',
    left: 6,
    height: 2,
    borderRadius: 100,
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 6,
    elevation: 4,
  },
  guidancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 100,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  guidancePillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  bottomBar: {
    position: 'absolute',
    left: 32,
    right: 32,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  circleDockButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  shutterOuterCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  shutterInnerCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  permissionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  permissionCenter: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  permissionIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  permissionHeading: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  permissionText: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  pillWhiteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 15,
    borderRadius: 100,
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  pillWhiteButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
  pillOutlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    backgroundColor: 'transparent',
  },
  pillOutlineButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  permissionFootnote: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    lineHeight: 16,
  },
});
