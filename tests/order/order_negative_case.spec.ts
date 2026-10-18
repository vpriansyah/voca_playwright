import type { Page } from '@playwright/test';
import {
  INVALID_DATA as BAD,
  ML_DENOMINATIONS as DENOM,
  PAYMENT_METHODS,
  PRODUCTS,
  VALIDATION_MESSAGES as MSG,
} from '../fixtures/config.ts';
import { expect, manualCase, test } from '../fixtures/test.ts';

/**
 * Order Product & Order Voucher — negative case
 * Sumber: "VocaGame - Playwright.csv". Judul test diawali TC_ID dari CSV.
 *
 * Tidak ada test di file ini yang mengklik Buy, jadi tidak membuat transaksi.
 * @manual = tidak bisa diuji lewat UI saja; tampil sebagai fixme + alasannya.
 */

const product = PRODUCTS.mobileLegends;
const account = product.account;
const denomination = DENOM.weeklyDiamondPass;
const TAG = ['@order', '@negative'];

/** Catat alert() yang muncul, untuk memastikan payload injeksi tidak dieksekusi. */
function trackAlerts(page: Page): () => boolean {
  let alerted = false;
  page.on('dialog', async (dialog) => {
    alerted = true;
    await dialog.dismiss();
  });
  return () => alerted;
}

test.describe('Order Product — negative', () => {
  test.beforeEach(async ({ productPage }) => {
    await productPage.open(product.path);
  });

  // ─── Input Account ────────────────────────────────────────────
  test.describe('Input Account', () => {
    test('OP-022 Both fields empty on order', { tag: TAG }, async ({ page, productPage }) => {
      await productPage.fillPlayer('', '');
      await productPage.fillEmail(account.email);

      await productPage.expectDenominationRejected(denomination, MSG.required);
      // Error di User ID dan Zone ID.
      await expect.poll(() => page.getByText(MSG.required).count()).toBeGreaterThanOrEqual(2);
    });

    test('OP-023 User ID filled, Zone ID empty', { tag: TAG }, async ({ productPage }) => {
      await productPage.fillPlayer('123456789', '');
      await productPage.fillEmail(account.email);
      await productPage.expectDenominationRejected(denomination, MSG.required);
    });

    test('OP-024 Zone ID filled, User ID empty', { tag: TAG }, async ({ productPage }) => {
      await productPage.fillPlayer('', '1234');
      await productPage.fillEmail(account.email);
      await productPage.expectDenominationRejected(denomination, MSG.required);
    });

    test('OP-025 User ID contains letters', { tag: TAG }, async ({ productPage }) => {
      await productPage.typeInto(productPage.userIdInput, BAD.userIdLetters);
      await expect(productPage.userIdInput).toHaveValue('');
    });

    test('OP-026 User ID with special characters and spaces', { tag: TAG }, async ({ productPage }) => {
      for (const value of BAD.userIdSpecial) {
        await test.step(value, async () => {
          await productPage.typeInto(productPage.userIdInput, value);
          await expect(productPage.userIdInput).toHaveValue(/^\d*$/);
        });
      }
    });

    test('OP-027 Zone ID contains letters or symbols', { tag: TAG }, async ({ productPage }) => {
      for (const value of BAD.zoneIdInvalid) {
        await test.step(value, async () => {
          await productPage.typeInto(productPage.zoneIdInput, value);
          await expect.soft(productPage.zoneIdInput).toHaveValue(/^\d*$/);
        });
      }
    });

    test('OP-028 Non-existent account (valid format, unregistered)', { tag: TAG }, async ({ productPage }) => {
      await productPage.fillPlayer(BAD.unregisteredAccount.userId, BAD.unregisteredAccount.zoneId);
      await productPage.blur();

      // Ditolak sebelum email dan denomination diisi.
      await productPage.expectMessage(MSG.accountNotFound);
      await expect(productPage.paymentDialog).toBeHidden();
    });

    test('OP-029 Injection payload in account fields', { tag: TAG }, async ({ page, productPage }) => {
      const alerted = trackAlerts(page);
      for (const payload of BAD.injection) {
        await test.step(payload, async () => {
          await productPage.typeInto(productPage.userIdInput, payload);
          await productPage.typeInto(productPage.zoneIdInput, payload);
          await expect(productPage.userIdInput).toHaveValue(/^\d*$/);
          await expect(productPage.zoneIdInput).toHaveValue(/^\d*$/);
        });
      }
      expect(alerted()).toBe(false);
      await expect(productPage.paymentDialog).toBeHidden();
    });

    test('OP-045 User ID minimum and maximum length', { tag: TAG }, async ({ page, productPage }) => {
      // Asumsi CSV: User ID 6-10 digit.
      const cases = [
        { value: '12345', valid: false },
        { value: '123456', valid: true },
        { value: '1234567890', valid: true },
        { value: '12345678901', valid: false },
      ];
      for (const { value, valid } of cases) {
        await test.step(`${value} (${valid ? 'valid' : 'invalid'} length)`, async () => {
          await productPage.typeInto(productPage.userIdInput, value);
          await productPage.typeInto(productPage.zoneIdInput, account.zoneId);
          await productPage.blur();

          if (valid) {
            // Lolos validasi format (pengecekan akun tetap berlaku).
            await expect.soft(productPage.userIdInput).toHaveValue(value);
          } else {
            // Ditolak: input dipotong, atau pesan error tampil.
            const kept = (await productPage.userIdInput.inputValue()) === value;
            if (kept) {
              await expect
                .soft(page.getByText(MSG.accountNotFound).or(page.getByText(MSG.required)).first())
                .toBeVisible();
            }
          }
        });
      }
    });

    test('OP-046 Zone ID length boundary', { tag: TAG }, async ({ page, productPage }) => {
      // Asumsi CSV: Zone ID 3-5 digit.
      const cases = [
        { value: '12', valid: false },
        { value: '123', valid: true },
        { value: '12345', valid: true },
        { value: '123456', valid: false },
      ];
      for (const { value, valid } of cases) {
        await test.step(`${value} (${valid ? 'valid' : 'invalid'} length)`, async () => {
          await productPage.typeInto(productPage.userIdInput, account.userId);
          await productPage.typeInto(productPage.zoneIdInput, value);
          await productPage.blur();

          if (valid) {
            await expect.soft(productPage.zoneIdInput).toHaveValue(value);
          } else {
            const kept = (await productPage.zoneIdInput.inputValue()) === value;
            if (kept) {
              await expect
                .soft(page.getByText(MSG.accountNotFound).or(page.getByText(MSG.required)).first())
                .toBeVisible();
            }
          }
        });
      }
    });

    test('OP-053 Paste User ID with leading and trailing spaces', { tag: TAG }, async ({ productPage }) => {
      await productPage.pasteInto(productPage.userIdInput, ' 123456789 ');
      // Dirapikan jadi angka saja, atau ditolak seluruhnya.
      await expect(productPage.userIdInput).toHaveValue(/^(123456789)?$/);
    });

    test('OP-054 Paste combined format "ID(Zone)" into User ID', { tag: TAG }, async ({ productPage }) => {
      await productPage.pasteInto(productPage.userIdInput, '123456789(1234)');

      // Dipisah otomatis ke User ID + Zone ID, atau ditolak; tidak boleh jadi ID gabungan yang rusak.
      const userId = await productPage.userIdInput.inputValue();
      expect(['', '123456789']).toContain(userId);
      if (userId === '123456789') await expect(productPage.zoneIdInput).toHaveValue('1234');
    });
  });

  // ─── Denomination Selection ───────────────────────────────────
  test.describe('Denomination Selection', () => {
    test('OP-030 Payment popup does not open without a denomination', { tag: TAG }, async ({ page, productPage }) => {
      await productPage.fillAccount(account);
      await productPage.blur();
      await page.waitForTimeout(2_000);
      await expect(productPage.paymentDialog).toBeHidden();
    });

    test('OP-057 Selected denomination after refresh or back navigation', { tag: TAG }, async ({ page, productPage, paymentDialog }) => {
      await productPage.fillAccount(account);
      await productPage.selectDenomination(denomination);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(productPage.userIdInput).toBeVisible();
      await page.waitForTimeout(3_000);

      // Kembali ke kondisi awal, atau memulihkan pilihan yang sama dengan harga yang cocok.
      if (await paymentDialog.root.isVisible()) {
        await paymentDialog.expectOpenWithItem(denomination);
        await expect(paymentDialog.root).toContainText(product.price);
      }
    });
  });

  // ─── Contact Info ─────────────────────────────────────────────
  test.describe('Contact Info', () => {
    test.beforeEach(async ({ productPage }) => {
      await productPage.fillPlayer(account.userId, account.zoneId);
    });

    test('OP-031 Email is empty', { tag: TAG }, async ({ productPage }) => {
      await productPage.fillEmail('');
      await productPage.expectDenominationRejected(denomination, MSG.required);
    });

    const emailCases = [
      { id: 'OP-032', title: 'Invalid email format', values: BAD.emailFormats },
      { id: 'OP-033', title: 'Phone number entered in the email field', values: BAD.emailPhones },
      { id: 'OP-058', title: 'Phone formats are rejected in the email field', values: BAD.emailPhoneFormats },
    ];
    for (const { id, title, values } of emailCases) {
      test(`${id} ${title}`, { tag: TAG }, async ({ productPage }) => {
        for (const value of values) {
          await test.step(value, async () => {
            await productPage.fillEmail(value);
            await productPage.expectDenominationRejected(denomination, MSG.invalidEmail);
          });
        }
      });
    }

    test('OP-034 Injection payload in the email field', { tag: TAG }, async ({ page, productPage }) => {
      const alerted = trackAlerts(page);
      for (const payload of BAD.emailInjection) {
        await test.step(payload, async () => {
          await productPage.fillEmail(payload);
          await productPage.expectDenominationRejected(denomination, MSG.invalidEmail);
        });
      }
      expect(alerted()).toBe(false);
    });

    test('OP-049 Very long email value', { tag: TAG }, async ({ productPage }) => {
      await productPage.fillEmail(BAD.emailTooLong);
      await productPage.blur();

      // Dipotong oleh field, atau ditolak dengan pesan.
      const kept = (await productPage.emailInput.inputValue()).length;
      if (kept > 254) await productPage.expectDenominationRejected(denomination, MSG.invalidEmail);
    });
  });

  // ─── Payment Method ───────────────────────────────────────────
  test.describe('Payment Method', () => {
    test('OP-035 Confirm inside the popup without a payment method', { tag: TAG }, async ({ productPage, paymentDialog }) => {
      await productPage.fillAccount(account);
      await productPage.selectDenomination(denomination);

      await expect(paymentDialog.root).toContainText(MSG.paymentRequired);
      await paymentDialog.expectBuyDisabled();
    });
  });

  // ─── Not automatable via UI ───────────────────────────────────
  test.describe('Manual', () => {
    manualCase('OP-036 Network lost during order submit', 'Membuat order sungguhan dan butuh cek riwayat order serta email.');
    manualCase('OP-037 Payment failed or declined', 'Butuh simulasi kegagalan di payment gateway.');
    manualCase('OP-038 Payment expires', 'Butuh menunggu batas waktu pembayaran (hingga 24 jam).');
    manualCase('OP-039 Pay an already expired code or QR', 'Butuh kode atau QR pembayaran yang sudah kedaluwarsa.');
    manualCase('OP-040 Delivery failure after successful payment', 'Butuh simulasi kegagalan API provider.');
    manualCase('OP-041 Price manipulation via request tampering', 'Butuh intercept dan modifikasi request order; membuat order sungguhan.');
    manualCase('OP-042 Access another user\'s invoice (IDOR)', 'Butuh dua order dari pengguna berbeda.');
    manualCase('OP-043 Product ID tampering', 'Butuh intercept dan modifikasi request order.');
    manualCase('OP-044 Rate limiting or brute-force on account check', 'Mengirim 50+ request per menit ke production; jalankan di staging.');
    manualCase('OP-061 Close page or back out during payment', 'Butuh link invoice dan akses email.');
    manualCase('OP-065 Session expires during checkout', 'Butuh login dan menunggu session kedaluwarsa.');
  });
});

test.describe('Order Voucher — negative', () => {
  test.beforeEach(async ({ productPage, paymentDialog }) => {
    await productPage.open(product.path);
    await productPage.fillAccount(account);
    await productPage.selectDenomination(denomination);
    await paymentDialog.selectPaymentMethod(PAYMENT_METHODS.qris);
  });

  test('OV-002 Invalid voucher code', { tag: TAG }, async ({ page, paymentDialog }) => {
    const totalBefore = await paymentDialog.total();
    await paymentDialog.applyVoucher(BAD.voucherInvalid);
    // Beri waktu respons pengecekan voucher dari server.
    await page.waitForTimeout(3_000);

    expect(await paymentDialog.total()).toBe(totalBefore);
  });

  test('OV-006 Click Apply with an empty voucher code', { tag: TAG }, async ({ paymentDialog }) => {
    const totalBefore = await paymentDialog.total();
    await expect(paymentDialog.voucherInput).toHaveValue('');
    // Apply nonaktif selama kode kosong, jadi tidak ada yang dikirim.
    await expect(paymentDialog.applyButton).toBeDisabled();
    expect(await paymentDialog.total()).toBe(totalBefore);
  });

  test('OV-010 Injection payload in Input Voucher Code', { tag: TAG }, async ({ page, paymentDialog }) => {
    const alerted = trackAlerts(page);
    const totalBefore = await paymentDialog.total();

    await paymentDialog.applyVoucher(BAD.voucherInjection);
    await page.waitForTimeout(3_000);

    expect(await paymentDialog.total()).toBe(totalBefore);
    expect(alerted()).toBe(false);
  });

  test.describe('Manual', () => {
    manualCase('OV-002b Expired or already-used voucher', 'Butuh kode voucher yang sudah kedaluwarsa dan yang sudah terpakai.');
    manualCase('OV-003 Voucher not valid for the selected product or payment method', 'Butuh kode voucher dengan batasan produk/metode bayar.');
    manualCase('OV-007 Voucher minimum amount is not met', 'Butuh kode voucher dengan minimum belanja.');
    manualCase('OV-009 Apply a second voucher code', 'Butuh dua kode voucher valid.');
  });
});
