import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTheme } from '../../context/ThemeContext';
import { X, ScanLine, Zap, ZapOff, RefreshCw } from 'lucide-react-native';

interface ScanReceiptModalProps {
  visible: boolean;
  onClose: () => void;
}

const Corner: React.FC<{ style: any }> = ({ style }) => (
  <View style={[styles.corner, style]} />
);

export const ScanReceiptModal: React.FC<ScanReceiptModalProps> = ({ visible, onClose }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [facing, setFacing] = useState<'back' | 'front'>('back');

  const frameW = Math.min(Dimensions.get('window').width - 72, 300);

  if (!visible) return null;

  const renderPermissionView = () => (
    <View style={[styles.container, { backgroundColor: colors.paper, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.permissionBox}>
        <View style={styles.permissionIcon}>
          <ScanLine size={30} color="#FFFFFF" />
        </View>
        <Text style={[styles.permissionTitle, { color: colors.ink }]}>
          {permission ? 'Camera access needed' : 'Checking camera…'}
        </Text>
        <Text style={[styles.permissionHint, { color: colors.inkSoft }]}>
          Barkadash uses your camera to scan receipts and add expenses to the ledger.
        </Text>
        {permission && !permission.granted && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={requestPermission}
            style={[styles.permissionBtn, { backgroundColor: colors.tealDark }]}
          >
            <Text style={styles.permissionBtnText}>Allow camera access</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity activeOpacity={0.7} onPress={onClose} style={styles.permissionClose}>
          <Text style={{ color: colors.inkSoft, fontSize: 12, fontWeight: '600' }}>Not now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      {!permission || !permission.granted ? (
        renderPermissionView()
      ) : (
        <View style={styles.container}>
          <CameraView style={StyleSheet.absoluteFill} facing={facing} enableTorch={torch} />

          {/* Dim vignette */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dim]} />

          {/* Simple scan frame */}
          <View pointerEvents="none" style={styles.centerWrap}>
            <View style={[styles.frame, { width: frameW, height: frameW }]}>
              <Corner style={{ top: -2, left: -2 }} />
              <Corner style={{ top: -2, right: -2, transform: [{ rotate: '90deg' }] }} />
              <Corner style={{ bottom: -2, left: -2, transform: [{ rotate: '180deg' }] }} />
              <Corner style={{ bottom: -2, right: -2, transform: [{ rotate: '270deg' }] }} />
            </View>
            <Text style={styles.scanHint}>Align the receipt inside the frame</Text>
            <Text style={styles.scanCaption}>Details will be filled in automatically</Text>
          </View>

          {/* Top Bar */}
          <View style={[styles.topBar, { top: insets.top + 8, zIndex: 10 }]}>
            <TouchableOpacity activeOpacity={0.8} onPress={onClose} style={styles.roundBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.title}>Scan Receipt</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Bottom Controls */}
          <View style={[styles.bottomBar, { bottom: insets.bottom + 24, zIndex: 10 }]}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setTorch((t) => !t)}
              style={styles.roundBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {torch ? <Zap size={20} color="#FFD166" /> : <ZapOff size={20} color="#FFFFFF" />}
            </TouchableOpacity>

            <View style={styles.shutterOuter}>
              <View style={styles.shutterInner} />
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
              style={styles.roundBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <RefreshCw size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  dim: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  centerWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  frame: {
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  corner: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#3EF2A0',
    borderTopLeftRadius: 8,
  },
  scanHint: {
    marginTop: 20,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  scanCaption: {
    marginTop: 5,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '500',
  },
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 48,
  },
  shutterOuter: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
  },
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  permissionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1F4E67',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  permissionHint: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 18,
  },
  permissionBtn: {
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  permissionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  permissionClose: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
});