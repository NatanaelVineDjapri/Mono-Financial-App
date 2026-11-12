// Automatic import (/settings/import): Import-Setup until something is set up, Import-Settings after.
// The route only wires data and navigation; the screen is src/features/import/ImportSettingsView.tsx
// and the rules (an app needs a rupiah account to be switched on) are src/domain/importApps.ts.
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { importAppError } from '@/i18n';
import { ImportPermissionSheet } from '@/features/import/ImportPermissionSheet';
import { ImportScreenView } from '@/features/import/ImportSettingsView';
import { shouldShowPermissionGuide, useNotificationAccess } from '@/features/import/notifications/access';
import * as native from '@/features/import/notifications/native';
import { useImportAppActions, useImportApps, type ImportActionResult } from '@/features/import/useImportApps';
import { AccountSheet } from '@/features/transactions/form/formSheets';
import { useTxFormData } from '@/features/transactions/form/useTxForm';
import type { ImportAppRow } from '@/data/repo/importApps';
import { MonoColors } from '@/theme/tokens';

export default function ImportSettingsRoute() {
  const router = useRouter();
  const { access, refresh } = useNotificationAccess();
  const { data } = useImportApps();
  const { data: formData } = useTxFormData();
  const actions = useImportAppActions();
  const [guide, setGuide] = useState(false);
  const [picker, setPicker] = useState<{ app: ImportAppRow; activate: boolean } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const accountNames = useMemo(() => new Map((formData?.accounts ?? []).map(a => [a.id, a.name] as const)), [formData]);

  const settle = (result: ImportActionResult) => setMessage(result.ok ? null : importAppError(result.code));

  const onToggle = async (app: ImportAppRow, on: boolean) => {
    if (!on) {
      settle(await actions.deactivate(app.package));
      return;
    }
    // An app is switched on only with an account to send its transactions to.
    if (app.account_id == null) setPicker({ app, activate: true });
    else settle(await actions.activate(app.package, null));
  };

  const onPickAccountFor = async (accountId: number) => {
    if (!picker) return;
    const { app, activate } = picker;
    setPicker(null);
    settle(activate ? await actions.activate(app.package, accountId) : await actions.setAccount(app.package, accountId));
  };

  if (!data) return <View style={styles.screen} />;

  return (
    <View style={styles.screen}>
      <ImportScreenView
        access={access}
        apps={data.apps}
        pending={data.pending}
        accountNames={accountNames}
        message={message}
        onBack={() => router.back()}
        onOpenGuide={() => {
          refresh();
          setGuide(true);
        }}
        onToggle={(app, on) => void onToggle(app, on)}
        onPickAccount={app => setPicker({ app, activate: false })}
        onOpenPending={() => router.push('/import/review' as never)}
        onRestartService={() => {
          native.requestRebind();
          refresh();
        }}
        onOpenBattery={() => native.openBatterySettings()}
      />
      <ImportPermissionSheet
        visible={guide && shouldShowPermissionGuide(access)}
        onClose={() => setGuide(false)}
        onOpenSettings={() => native.openAppInfo()}
        onOpenAccess={() => native.openAccessSettings()}
      />
      <AccountSheet
        visible={picker != null}
        role="account"
        accounts={formData?.accounts ?? []}
        selectedId={picker?.app.account_id ?? null}
        onSelect={id => void onPickAccountFor(id)}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MonoColors.bg },
});
