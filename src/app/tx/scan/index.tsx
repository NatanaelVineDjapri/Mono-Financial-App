// Scan a receipt (/tx/scan, the Scan choice of the + menu; board Receipt-Scan). A camera view with
// a corner frame, a flash toggle, the gallery, the shutter and "Isi manual". The picture is read on
// the phone (src/features/receipt/ocr.ts), deleted at once, and what was read becomes a draft on
// the review screen: nothing is saved here.
//
// States: asking for / denied camera permission (open settings, or pick a photo from the gallery
// instead), reading ("Membaca struk…"), and the failure card ("Struk belum terbaca…", with Foto
// ulang and Isi manual). Never `Alert`.
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { today as todayLocal } from '@/core/clock';
import { discardCachedImage } from '@/features/receipt/cache';
import { scanImage } from '@/features/receipt/scan';
import { useReceiptStore } from '@/features/receipt/store';
import {
  receiptAllowCameraLabel,
  receiptCloseLabel,
  receiptFlashLabel,
  receiptForeignMessage,
  receiptFrameHint,
  receiptGalleryLabel,
  receiptManualLabel,
  receiptOpenSettingsLabel,
  receiptPermissionBody,
  receiptPermissionTitle,
  receiptReadingLabel,
  receiptRetakeLabel,
  receiptShutterLabel,
  receiptUnreadableMessage,
  scanReceiptTitle,
} from '@/i18n';
import { MonoColors } from '@/theme/tokens';
import { MonoText } from '@/theme/typography';

const SCRIM = 'rgba(10,10,10,0.6)';
const CORNER = 34;

type Failure = 'unreadable' | 'foreign';

export default function ScanReceiptScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [flashOn, setFlashOn] = useState(false);
  const [reading, setReading] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const busy = useRef(false);

  // A new scan starts from nothing: a draft left over from before is gone.
  useEffect(() => {
    useReceiptStore.getState().clear();
  }, []);

  // The first visit asks for the camera; coming back from the system settings re-reads the answer.
  useEffect(() => {
    if (permission && permission.status === 'undetermined' && permission.canAskAgain) void requestPermission();
  }, [permission, requestPermission]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void getPermission();
    });
    return () => subscription.remove();
  }, [getPermission]);

  // From a picture to the review: read it, and either show the draft or the failure card.
  const process = useCallback(
    async (uri: string) => {
      if (busy.current) {
        discardCachedImage(uri);
        return;
      }
      busy.current = true;
      setFailure(null);
      setReading(true);
      try {
        const outcome = await scanImage(uri, todayLocal());
        if (outcome.ok) {
          useReceiptStore.getState().setResult(outcome.parsed, outcome.imageUri, outcome.lines);
          router.replace('/tx/scan/review' as never);
        } else {
          setFailure(outcome.reason);
        }
      } finally {
        setReading(false);
        busy.current = false;
      }
    },
    [router],
  );

  const takePhoto = useCallback(async () => {
    if (busy.current || !camera.current) return;
    try {
      const picture = await camera.current.takePictureAsync({ quality: 0.8, skipProcessing: false });
      if (__DEV__) console.warn('[receipt] picture taken:', picture.uri);
      await process(picture.uri);
    } catch (error) {
      if (__DEV__) console.warn('[receipt] taking the picture failed:', error);
      setFailure('unreadable');
    }
  }, [process]);

  const pickFromGallery = useCallback(async () => {
    if (busy.current) return;
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: false });
      if (picked.canceled || picked.assets.length === 0) return;
      if (__DEV__) console.warn('[receipt] picture picked:', picked.assets[0].uri);
      await process(picked.assets[0].uri);
    } catch (error) {
      if (__DEV__) console.warn('[receipt] picking the picture failed:', error);
      setFailure('unreadable');
    }
  }, [process]);

  const fillManually = useCallback(() => router.replace('/tx/add' as never), [router]);
  const close = useCallback(() => router.back(), [router]);

  // ---- permission not granted yet
  if (!permission) return <View style={styles.screen} />;
  if (!permission.granted) {
    return (
      <View style={[styles.screen, styles.permission, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.headerRow}>
          <RoundButton label={receiptCloseLabel()} onPress={close} testID="scan-close">
            <Icon name="close" size={22} color={MonoColors.text} />
          </RoundButton>
        </View>
        <View style={styles.permissionBody}>
          <View style={styles.disc}>
            <Icon name="scan" size={26} color={MonoColors.accent} />
          </View>
          <Text style={styles.permissionTitle} accessibilityRole="header">
            {receiptPermissionTitle()}
          </Text>
          <Text style={styles.permissionText}>{receiptPermissionBody()}</Text>
        </View>
        <View style={styles.permissionActions}>
          <Button label={receiptOpenSettingsLabel()} onPress={() => void Linking.openSettings()} testID="scan-open-settings" />
          <Button label={receiptGalleryLabel()} variant="secondary" icon="image" onPress={() => void pickFromGallery()} testID="scan-gallery" />
          {permission.canAskAgain && (
            <Button label={receiptAllowCameraLabel()} variant="secondary" onPress={() => void requestPermission()} testID="scan-allow-camera" />
          )}
          <Pressable onPress={fillManually} accessibilityRole="button" style={styles.textButton} testID="scan-manual">
            <Text style={styles.manualText}>{receiptManualLabel()}</Text>
          </Pressable>
        </View>
        {reading && <ReadingOverlay />}
        {failure && <FailureCard reason={failure} onRetry={() => setFailure(null)} onManual={fillManually} />}
      </View>
    );
  }

  // ---- the camera
  return (
    <View style={styles.screen}>
      <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" flash={flashOn ? 'on' : 'off'} mode="picture" />
      {/* Behind the reading overlay or the failure card the controls are out of reach for screen readers too. */}
      <View
        style={[styles.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom + 28 }]}
        pointerEvents="box-none"
        importantForAccessibility={reading || failure ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={reading || failure != null}
      >
        <View style={styles.headerRow}>
          <RoundButton label={receiptCloseLabel()} onPress={close} testID="scan-close">
            <Icon name="close" size={22} color={MonoColors.text} />
          </RoundButton>
          <Text style={styles.title} accessibilityRole="header">
            {scanReceiptTitle()}
          </Text>
          <RoundButton label={receiptFlashLabel(flashOn)} onPress={() => setFlashOn(v => !v)} selected={flashOn} testID="scan-flash">
            <Icon name="flash" size={22} color={flashOn ? MonoColors.accent : MonoColors.text} />
          </RoundButton>
        </View>

        <View style={styles.frame} pointerEvents="none">
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
        </View>
        <Text style={styles.hint}>{receiptFrameHint()}</Text>

        <View style={styles.controls}>
          <Pressable
            onPress={() => void pickFromGallery()}
            accessibilityRole="button"
            accessibilityLabel={receiptGalleryLabel()}
            style={styles.gallery}
            testID="scan-gallery"
          >
            <Icon name="image" size={24} color={MonoColors.text} />
          </Pressable>
          <Pressable
            onPress={() => void takePhoto()}
            accessibilityRole="button"
            accessibilityLabel={receiptShutterLabel()}
            style={styles.shutter}
            testID="scan-shutter"
          >
            <View style={styles.shutterInner} />
          </Pressable>
          <Pressable onPress={fillManually} accessibilityRole="button" style={styles.manual} testID="scan-manual">
            <Text style={styles.manualText}>{receiptManualLabel()}</Text>
          </Pressable>
        </View>
      </View>
      {reading && <ReadingOverlay />}
      {failure && <FailureCard reason={failure} onRetry={() => setFailure(null)} onManual={fillManually} />}
    </View>
  );
}

function RoundButton({ label, onPress, children, selected = false, testID }: { label: string; onPress: () => void; children: ReactNode; selected?: boolean; testID?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={styles.round}
      testID={testID}
    >
      {children}
    </Pressable>
  );
}

function ReadingOverlay() {
  return (
    <View style={styles.cover} accessibilityLiveRegion="polite" testID="scan-reading">
      <ActivityIndicator color={MonoColors.text} />
      <Text style={styles.coverText}>{receiptReadingLabel()}</Text>
    </View>
  );
}

function FailureCard({ reason, onRetry, onManual }: { reason: Failure; onRetry: () => void; onManual: () => void }) {
  return (
    <View style={styles.cover} testID="scan-failure">
      <View style={styles.card} accessibilityViewIsModal>
        <View style={styles.disc}>
          <Icon name="alert" size={26} color={MonoColors.negative} />
        </View>
        <Text style={styles.cardText} accessibilityLiveRegion="polite">
          {reason === 'foreign' ? receiptForeignMessage() : receiptUnreadableMessage()}
        </Text>
        <View style={styles.cardActions}>
          <Button label={receiptManualLabel()} variant="secondary" onPress={onManual} style={styles.cardButton} testID="scan-failure-manual" />
          <Button label={receiptRetakeLabel()} onPress={onRetry} style={styles.cardButton} testID="scan-failure-retry" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  overlay: { flex: 1 },
  headerRow: { height: 56, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center' },
  title: { ...MonoText.titleM, color: MonoColors.text, flex: 1, textAlign: 'center' },
  round: { width: 48, height: 48, borderRadius: 24, backgroundColor: SCRIM, alignItems: 'center', justifyContent: 'center' },

  frame: { flex: 1, marginTop: 18, marginHorizontal: 28, maxHeight: 540 },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: MonoColors.text, borderWidth: 3 },
  tl: { left: 0, top: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 12 },
  tr: { right: 0, top: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 12 },
  bl: { left: 0, bottom: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 12 },
  br: { right: 0, bottom: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 12 },
  hint: { ...MonoText.body, color: MonoColors.text, textAlign: 'center', marginTop: 18, marginHorizontal: 28 },

  controls: { paddingHorizontal: 28, paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  gallery: { width: 56, height: 56, borderRadius: 16, backgroundColor: SCRIM, borderWidth: 1, borderColor: '#3A3A3B', alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: MonoColors.text, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: MonoColors.text },
  manual: { minWidth: 56, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  manualText: { ...MonoText.chip, color: MonoColors.text, textAlign: 'center' },

  permission: { backgroundColor: MonoColors.bg },
  permissionBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 28 },
  permissionTitle: { ...MonoText.titleM, color: MonoColors.text, textAlign: 'center' },
  permissionText: { ...MonoText.body, color: MonoColors.textSecond, textAlign: 'center' },
  permissionActions: { paddingHorizontal: 16, gap: 12 },
  textButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  disc: { width: 56, height: 56, borderRadius: 18, backgroundColor: '#1D1D1E', borderWidth: 1, borderColor: '#2A2A2B', alignItems: 'center', justifyContent: 'center' },

  cover: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.68)', alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 16 },
  coverText: { ...MonoText.body, color: MonoColors.text },
  card: { alignSelf: 'stretch', backgroundColor: '#131314', borderColor: '#2A2A2B', borderWidth: 1, borderRadius: 24, padding: 20, gap: 16, alignItems: 'center' },
  cardText: { ...MonoText.body, color: MonoColors.text, textAlign: 'center' },
  cardActions: { alignSelf: 'stretch', flexDirection: 'row', gap: 8 },
  cardButton: { flex: 1 },
});
