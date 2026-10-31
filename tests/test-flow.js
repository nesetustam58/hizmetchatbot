/**
 * Uçtan Uca 10 Adımlık Sohbet Akışı & KVKK Testi
 */

import { initDatabase, DB, CustomerRepo, MessageRepo, AppointmentRepo } from '../src/database/db.js';
import { processCustomerMessage, handlePaymentCompletedWebhook, STEPS } from '../src/core/state-machine.js';

async function runTest() {
  console.log('🧪 HizmetChatbot 10 Adımlık Akış Testi Başlatılıyor...\n');

  // Veritabanını sıfırdan hazırla
  initDatabase();

  const testPhone = '+905320001122';

  // 1. Müşteri ilk mesajı atar
  console.log('--- 1. ADIM: Müşteri İlk Mesajı ---');
  let res = await processCustomerMessage(testPhone, 'Selam kombi bakımı yaptıracaktım');
  console.log('Bot Cevabı:\n', res.replyText);
  console.log('Mevcut Adım:', res.currentStep, '\n');

  // 2. Müşteri KVKK onaylar
  console.log('--- 2. ADIM: KVKK Onayı ---');
  res = await processCustomerMessage(testPhone, '1');
  console.log('Bot Cevabı:\n', res.replyText);
  console.log('Mevcut Adım:', res.currentStep, '\n');

  // 3. Müşteri Hizmet seçer (1: Kombi Bakım)
  console.log('--- 3. ADIM: Hizmet Seçimi ---');
  res = await processCustomerMessage(testPhone, '1');
  console.log('Bot Cevabı:\n', res.replyText);
  console.log('Mevcut Adım:', res.currentStep, '\n');

  // 4. Müşteri Semtini yazar
  console.log('--- 4. & 5. ADIM: Semt & Usta / Slot Önerisi ---');
  res = await processCustomerMessage(testPhone, 'Kadıköy Moda Caferağa');
  console.log('Bot Cevabı:\n', res.replyText);
  console.log('Mevcut Adım:', res.currentStep, '\n');

  // 5. Müşteri Slot seçer (A)
  console.log('--- 6. & 7. ADIM: Slot Seçimi & POS Linki ---');
  res = await processCustomerMessage(testPhone, 'A');
  console.log('Bot Cevabı:\n', res.replyText);
  console.log('Mevcut Adım:', res.currentStep);
  const appointmentId = res.metadata.appointmentId;
  console.log('Oluşturulan Randevu ID:', appointmentId, '\n');

  // 6. POS Webhook Simülasyonu (Müşteri link üzerinden ödedi ve adres girdi)
  console.log('--- 8., 9. & 10. ADIM: Sanal POS Webhook & Kesinleşme ---');
  const webhookRes = await handlePaymentCompletedWebhook(appointmentId, {
    transactionId: 'TRX_TEST_998172',
    fullAddress: 'Caferağa Mah. Şair Nefi Sok. No:12 D:3 Kadıköy/İstanbul',
    notes: 'Kombi Demirdöküm Nitromix, balkon dolabı içinde.'
  });
  console.log('Webhook Başarılı:', webhookRes.success);
  console.log('Müşteriye Giden Kesin Randevu Onayı:\n', webhookRes.confirmationMessage, '\n');

  // 7. Kontrol: Müşterinin son durumu
  const customer = CustomerRepo.getByPhone(testPhone);
  console.log('Müşteri Veritabanı Kaydı:');
  console.log('• Adım:', customer.current_step);
  console.log('• KVKK İzni:', customer.kvkk_consent_granted);
  console.log('• Mahalle:', customer.neighborhood);
  console.log('• Açık Adres:', customer.full_address);

  // 8. Opt-out Testi
  console.log('\n--- RET / Opt-out Testi ---');
  const optOutRes = await processCustomerMessage(testPhone, 'RET');
  console.log('Opt-out Cevabı:', optOutRes.replyText);
  const updatedCust = CustomerRepo.getByPhone(testPhone);
  console.log('Güncel KVKK Durumu (İptal):', updatedCust.kvkk_consent_granted);

  console.log('\n✅ TÜM TESTLER BAŞARIYLA TAMAMLANDI!');
}

runTest().catch(err => {
  console.error('❌ Test Hatası:', err);
  process.exit(1);
});
