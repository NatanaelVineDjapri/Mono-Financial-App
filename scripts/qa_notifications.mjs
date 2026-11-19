// QA script: jalankan logika notifikasi tanpa device.
// node scripts/qa_notifications.mjs

import { planSchedule } from '../src/domain/notify/planSchedule.ts';
import { evaluateAlerts } from '../src/domain/notify/evaluateAlerts.ts';
import { materializeDue } from '../src/domain/notify/materializeDue.ts';
import { renderNotification } from '../src/features/notifications/copy.ts';

// Tidak bisa import TS langsung — gunakan jest runner.
console.log('Gunakan: npx jest --testPathPatterns="qa_notify" --no-coverage --verbose');
