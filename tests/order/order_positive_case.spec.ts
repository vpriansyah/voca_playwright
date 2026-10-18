import {
  ML_DENOMINATIONS as DENOM,
  PAYMENT_GROUPS,
  PAYMENT_METHODS,
  PRODUCTS,
  VALIDATION_MESSAGES as MSG,
} from '../fixtures/config.ts';
import { expect, manualCase, test } from '../fixtures/test.ts';
import { PaymentDialog } from '../pages/PaymentDialog.ts';
import { ProductPage } from '../pages/ProductPage.ts';

/**
 * Order Product & Order Voucher — positive case
 * Sumber: "VocaGame - Playwright.csv". Judul test diawali TC_ID dari CSV.
 *
 * Tag:
 *   @order          semua test di file ini
 *   @creates-order  klik Buy → membuat transaksi sungguhan. Jalan atau tidaknya
 *                   diatur ordersByDefault di fixtures/env.ts; RUN_ORDERS=1 / 0 menimpa.
 *   @manual         tidak bisa diuji lewat UI saja; tampil sebagai fixme + alasannya.
 *
 * Test tanpa @creates-order berhenti sebelum Buy, jadi tidak membuat transaksi.
 */

const product = PRODUCTS.mobileLegends;
const account = product.account;
const TAG = '@order';
const CREATES_ORDER = ['@order', '@creates-order'];

// Jeda sebelum setiap action agar alur bisa diamati dan halaman sempat merespons.
test.use({ launchOptions: { slowMo: 2_000 } });
// slowMo membuat test lebih lama dari timeout 90 detik di playwright.config.ts.
test.describe.configure({ timeout: 180_000 });

test.describe('Order Product — positive', () => {
  // ─── Page Display ──────────────────────────────────────────────
  test.describe('Page Display', () => {
    test.beforeEach(async ({ productPage }) => {
      await productPage.open(product.path);
    });

    test('OP-001 Product page loads completely', { tag: TAG }, async ({ page, productPage }) => {
      await expect(page.getByRole('textbox', { name: 'Cari' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Mobile Legends: Bang Bang' }).first()).toBeVisible();
      await expect(productPage.userIdInput).toBeVisible();
      await expect(productPage.zoneIdInput).toBeVisible();
      await expect(productPage.emailInput).toBeVisible();
      await expect(productPage.card(product.denomination)).toBeVisible();
      await expect(productPage.paymentDialog).toBeHidden();
    });

    test('OP-002 Denomination cards show complete info', { tag: TAG }, async ({ productPage }) => {
      await productPage.revealDenominationCards(product.denomination);

      const cards = productPage.denominationCards;
      const count = await cards.count();
      expect(count).toBeGreaterThan(0);

      for (let i = 0; i < count; i++) {
        const card = cards.nth(i);
        // Harga Rupiah dengan pemisah ribuan, mis. "Rp 35,756".
        await expect.soft(card.getByRole('button', { name: /^Rp \d{1,3}(,\d{3})*$/ })).toBeVisible();
        await expect.soft(card.getByRole('img').first()).toBeVisible();
      }
    });

    test('OP-003 Category tabs scroll to the matching section', { tag: TAG }, async ({ page, productPage }) => {
      await productPage.revealDenominationCards(product.denomination);

      const tabLabels = await productPage.categoryTabs.evaluateAll((tabs) =>
        tabs.map((tab) => tab.getAttribute('aria-label') ?? ''),
      );
      expect(tabLabels.length).toBeGreaterThan(0);

      for (const label of tabLabels) {
        const section = label.replace(/^button tabs /, '');
        await page.getByRole('button', { name: label, exact: true }).click();
        // Gambar pertama dengan nama ini adalah ikon di tab; yang kedua adalah judul section.
        await expect.soft(page.getByRole('img', { name: section, exact: true }).nth(1)).toBeInViewport();
      }
    });

    test('OP-050 Price stays the same from the card to the payment popup', { tag: TAG }, async ({ productPage, paymentDialog }) => {
      await productPage.fillAccount(account);
      await productPage.selectDenomination(DENOM.weeklyDiamondPass);
      // Sebelum metode bayar dipilih, Total = harga item.
      const popupTotal = await paymentDialog.total();
      await paymentDialog.close();

      expect(await productPage.cardPrice(DENOM.weeklyDiamondPass)).toBe(popupTotal);
      // Perbandingan dengan invoice butuh order sungguhan; dicakup OP-016.
    });

    test('OP-051 Responsive layout on different screen sizes', { tag: TAG }, async ({ page, productPage }) => {
      for (const width of [1920, 768, 375]) {
        await test.step(`${width}px`, async () => {
          await page.setViewportSize({ width, height: 900 });
          await expect
            .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
            .toBe(true);
          await expect(productPage.userIdInput).toBeVisible();
          await expect(productPage.zoneIdInput).toBeVisible();
          await expect(productPage.emailInput).toBeVisible();
        });
      }
    });

    test('OP-052 Language and currency switch', { tag: TAG }, async ({ page, productPage }) => {
      await expect(page.getByText('Masukkan Kontak Anda')).toBeVisible();

      await page.getByRole('button', { name: 'Indonesia' }).first().click();
      await page.getByText('English', { exact: true }).click();
      await page.getByRole('button', { name: 'Simpan' }).click();

      // Label berbahasa Indonesia berganti; denomination tetap tersedia.
      await expect(page.getByText('Masukkan Kontak Anda')).toBeHidden();
      await expect(productPage.card(product.denomination)).toBeVisible();
    });
  });

  // ─── Input Account & Contact Info ─────────────────────────────
  test.describe('Input Account & Contact Info', () => {
    test.beforeEach(async ({ productPage }) => {
      await productPage.open(product.path);
    });

    test('OP-004 Input valid User ID and Zone ID', { tag: TAG }, async ({ productPage }) => {
      await productPage.fillPlayer(account.userId, account.zoneId);
      await productPage.blur();

      await expect(productPage.userIdInput).toHaveValue(account.userId);
      await expect(productPage.zoneIdInput).toHaveValue(account.zoneId);
      // Nickname muncul setelah pengecekan akun selesai.
      await productPage.expectNickname(product.nickname);
      await productPage.expectNoMessage(MSG.required);
      await productPage.expectNoMessage(MSG.accountNotFound);
    });

    test('OP-005 Account nickname verification', { tag: TAG }, async ({ productPage }) => {
      await productPage.fillPlayer(account.userId, account.zoneId);
      await productPage.blur();

      // Email dan denomination belum diisi.
      await productPage.expectNickname(product.nickname);
      await expect(productPage.emailInput).toHaveValue('');
    });

    test('OP-013 Input a valid email', { tag: TAG }, async ({ productPage }) => {
      await productPage.fillPlayer(account.userId, account.zoneId);
      await productPage.fillEmail('test@example.com');
      await productPage.blur();

      await productPage.expectNoMessage(MSG.invalidEmail);
      await expect(productPage.paymentDialog).toBeHidden();
    });

    test('OP-055 Input values persist after tab switch and page scroll', { tag: TAG }, async ({ productPage }) => {
      // Dimunculkan saat form masih kosong agar dialog pembayaran tidak terbuka.
      await productPage.revealDenominationCards(product.denomination);
      await productPage.fillAccount(account);

      const tabCount = await productPage.categoryTabs.count();
      for (let i = 0; i < tabCount; i++) {
        await productPage.categoryTabs.nth(i).click();
      }

      await productPage.expectAccount(account);
      await expect(productPage.paymentDialog).toBeHidden();
    });

    test('OP-059 Email with uppercase letters and trailing spaces', { tag: TAG }, async ({ productPage, paymentDialog }) => {
      await productPage.fillPlayer(account.userId, account.zoneId);
      await productPage.fillEmail(' Budi@Example.COM ');
      await productPage.blur();
      await productPage.expectNoMessage(MSG.invalidEmail);

      await productPage.selectDenomination(DENOM.weeklyDiamondPass);
      await expect(paymentDialog.root).toContainText(/Budi@Example\.COM/i);
      // Pengiriman invoice ke alamat ini butuh order sungguhan dan akses email.
    });
  });

  // ─── Denomination Selection ───────────────────────────────────
  test.describe('Denomination Selection', () => {
    test.beforeEach(async ({ productPage }) => {
      await productPage.open(product.path);
      await productPage.fillAccount(account);
    });

    test('OP-006 Select a Diamond denomination', { tag: TAG }, async ({ productPage, paymentDialog }) => {
      await productPage.selectDenomination(DENOM.diamondA);
      await paymentDialog.expectOpenWithItem(DENOM.diamondA);
    });

    test('OP-007 Change selection to another denomination', { tag: TAG }, async ({ productPage, paymentDialog }) => {
      await productPage.selectDenomination(DENOM.diamondA);
      await paymentDialog.close();

      await productPage.selectDenomination(DENOM.diamondB);
      await paymentDialog.expectOpenWithItem(DENOM.diamondB);
      await expect(paymentDialog.root).not.toContainText(DENOM.diamondA);
    });

    test('OP-008 Deselect denomination by clicking it again', { tag: TAG }, async ({ page, productPage, paymentDialog }) => {
      await productPage.selectDenomination(DENOM.weeklyDiamondPass);
      await paymentDialog.close();

      await productPage.card(DENOM.weeklyDiamondPass).click();
      // Beri waktu dialog terbuka jika situs tidak mendukung toggle-off.
      await page.waitForTimeout(2_000);

      // Boleh tertutup (deselect) atau terbuka lagi dengan item yang sama, tapi tidak dengan data lama yang salah.
      if (await paymentDialog.root.isVisible()) {
        await paymentDialog.expectOpenWithItem(DENOM.weeklyDiamondPass);
        await expect(paymentDialog.root).toContainText(product.price);
      }
    });

    test('OP-009 Select Weekly Diamond Pass', { tag: TAG }, async ({ productPage, paymentDialog }) => {
      await productPage.selectDenomination(DENOM.weeklyDiamondPass);
      await paymentDialog.expectOpenWithItem(DENOM.weeklyDiamondPass);
      await expect(paymentDialog.root).toContainText(product.price);
    });

    test('OP-010 Select Twilight Pass', { tag: TAG }, async ({ productPage, paymentDialog }) => {
      await productPage.selectDenomination(DENOM.twilightPass);
      await paymentDialog.expectOpenWithItem(DENOM.twilightPass);
    });

    test('OP-011 Select Limited Time Bundle', { tag: TAG }, async ({ productPage, paymentDialog }) => {
      for (const bundle of DENOM.bundles) {
        await test.step(bundle, async () => {
          await productPage.selectDenomination(bundle);
          await paymentDialog.expectOpenWithItem(bundle);
          await paymentDialog.close();
        });
      }
    });

    test('OP-012 Select 2x Recharge Bonus items', { tag: TAG }, async ({ productPage, paymentDialog }) => {
      for (const item of DENOM.recharge) {
        await test.step(item, async () => {
          await productPage.selectDenomination(item);
          await paymentDialog.expectOpenWithItem(item);
          await paymentDialog.close();
        });
      }
    });

    test('OP-047 Smallest denomination (5 Diamonds)', { tag: TAG }, async ({ productPage, paymentDialog }) => {
      await productPage.selectDenomination(DENOM.smallestDiamond);
      await paymentDialog.expectOpenWithItem(DENOM.smallestDiamond);
      await paymentDialog.selectPaymentMethod(PAYMENT_METHODS.qris);
      // Siap dibeli; Buy tidak diklik agar tidak membuat transaksi.
      await paymentDialog.expectBuyEnabled();
    });

    test('OP-048 Largest denomination', { tag: TAG }, async ({ productPage, paymentDialog }) => {
      await productPage.selectDenomination(DENOM.largestDiamond);
      await paymentDialog.expectOpenWithItem(DENOM.largestDiamond);
      await paymentDialog.selectPaymentMethod(PAYMENT_METHODS.qris);
      await paymentDialog.expectBuyEnabled();
    });

    test('OP-060 Change the denomination after the payment popup opens', { tag: TAG }, async ({ productPage, paymentDialog }) => {
      await productPage.selectDenomination(DENOM.diamondA);
      await paymentDialog.close();

      await productPage.selectDenomination(DENOM.diamondB);
      await paymentDialog.expectOpenWithItem(DENOM.diamondB);
      await expect(paymentDialog.root).not.toContainText(DENOM.diamondA);
      await paymentDialog.selectPaymentMethod(PAYMENT_METHODS.qris);
      await paymentDialog.expectBuyEnabled();
    });
  });

  // ─── Payment Method & Order Review ────────────────────────────
  test.describe('Payment Method & Order Review', () => {
    test.beforeEach(async ({ productPage }) => {
      await productPage.open(product.path);
      await productPage.fillAccount(account);
      await productPage.selectDenomination(DENOM.weeklyDiamondPass);
    });

    test('OP-014 Payment popup opens after a denomination is selected', { tag: TAG }, async ({ page, paymentDialog }) => {
      for (const group of PAYMENT_GROUPS) {
        await test.step(group, async () => {
          await expect(paymentDialog.paymentGroup(group)).toBeVisible();
          await paymentDialog.paymentGroup(group).click();
          // Fee per metode tidak ditampilkan di daftar; yang dicek, opsinya muncul.
          await expect.soft(page.getByRole('region', { name: group }).getByRole('img').first()).toBeVisible();
        });
      }
      expect(await paymentDialog.total()).toMatch(/^Rp/);
    });

    test('OP-015 Selecting a payment method in the popup updates the total', { tag: TAG }, async ({ paymentDialog }) => {
      await paymentDialog.selectPaymentMethod(PAYMENT_METHODS.qris);
      const totalQris = await paymentDialog.total();
      expect(totalQris).toMatch(/^Rp/);

      await paymentDialog.selectFirstOptionIn('E-Wallet');
      await expect.poll(() => paymentDialog.total()).toMatch(/^Rp/);
      // Total = harga + fee - diskon; fee tiap metode belum dipetakan, jadi hanya formatnya yang dicek.
    });

    test('OP-017 Review the order inside the payment popup', { tag: TAG }, async ({ paymentDialog }) => {
      await paymentDialog.expectOrderDetails(account, product.nickname, DENOM.weeklyDiamondPass);
      await expect(paymentDialog.root).toContainText(product.price);
    });
  });

  // ─── Place Order (membuat transaksi) ──────────────────────────
  test.describe('Place Order', () => {
    // Tambah kombinasi: pakai key dari PRODUCTS dan PAYMENT_METHODS di fixtures/config.ts.
    const ORDER_CASES: Array<{
      product: keyof typeof PRODUCTS;
      payment: keyof typeof PAYMENT_METHODS;
    }> = [
      { product: 'mobileLegends', payment: 'qris' },
      // { product: 'namaProduk', payment: 'namaMetode' },
    ];

    for (const { product: productKey, payment: paymentKey } of ORDER_CASES) {
      const orderProduct = PRODUCTS[productKey];
      const payment = PAYMENT_METHODS[paymentKey];

      test(
        `OP-016 Complete order with all valid data (${productKey} via ${paymentKey})`,
        { tag: CREATES_ORDER },
        async ({ homePage, productPage, paymentDialog }) => {
          await test.step('Search for the product', async () => {
            await homePage.open();
            await homePage.openProduct(orderProduct.searchKeyword, orderProduct.productName);
          });

          await test.step('Fill in account details', async () => {
            await productPage.fillAccount(orderProduct.account);
            await productPage.expectAccount(orderProduct.account);
          });

          await test.step('Select denomination', async () => {
            await productPage.selectDenomination(orderProduct.denomination);
          });

          await test.step(`Select payment method (${payment.option})`, async () => {
            await paymentDialog.selectPaymentMethod(payment);
          });

          await test.step('Submit order and verify transaction code', async () => {
            await paymentDialog.buy();
            await paymentDialog.expectTransactionCode();
          });
        },
      );
    }

    test('OP-064 Order number uniqueness', { tag: CREATES_ORDER }, async ({ productPage, paymentDialog }) => {
      const codes: string[] = [];
      for (const attempt of [1, 2]) {
        await test.step(`Order #${attempt}`, async () => {
          await productPage.open(product.path);
          await productPage.fillAccount(account);
          await productPage.selectDenomination(DENOM.smallestDiamond);
          await paymentDialog.selectPaymentMethod(PAYMENT_METHODS.qris);
          await paymentDialog.buy();
          codes.push(await paymentDialog.readTransactionCode());
        });
      }
      expect(new Set(codes).size).toBe(codes.length);
    });

    test('OP-066 Same account ordering from two tabs simultaneously', { tag: CREATES_ORDER }, async ({ context }) => {
      const tabs = await Promise.all([context.newPage(), context.newPage()]);
      const flows = tabs.map((tab) => ({ product: new ProductPage(tab), dialog: new PaymentDialog(tab) }));

      for (const flow of flows) {
        await flow.product.open(product.path);
        await flow.product.fillAccount(account);
        await flow.product.selectDenomination(DENOM.smallestDiamond);
        await flow.dialog.selectPaymentMethod(PAYMENT_METHODS.qris);
        await flow.dialog.expectBuyEnabled();
      }

      // Klik Buy di kedua tab bersamaan.
      await Promise.all(flows.map((flow) => flow.dialog.buyButton.click()));
      const codes = await Promise.all(flows.map((flow) => flow.dialog.readTransactionCode()));
      expect(codes[0]).not.toBe(codes[1]);
    });
  });

  // ─── Not automatable via UI ───────────────────────────────────
  test.describe('Manual', () => {
    manualCase('OP-018 Successful payment', 'Butuh pembayaran sungguhan lewat payment gateway.');
    manualCase('OP-019 Diamonds delivered to the correct account', 'Butuh login ke akun game untuk cek saldo diamond.');
    manualCase('OP-020 Invoice and notification after order', 'Butuh akses inbox email dan order yang sudah dibayar.');
    manualCase('OP-021 Order as logged-in user', 'Butuh kredensial akun VocaGame untuk login.');
    manualCase('OP-056 Bonus diamond information accuracy', 'Butuh pembayaran dan cek saldo diamond di dalam game.');
    manualCase('OP-062 Payment success callback delayed', 'Butuh simulasi callback payment gateway yang terlambat.');
    manualCase('OP-063 Order tracking by order number', 'Butuh nomor order sungguhan; halaman lacak order belum dipetakan.');
  });
});

test.describe('Order Voucher — positive', () => {
  test.describe('Payment popup', () => {
    test.beforeEach(async ({ productPage }) => {
      await productPage.open(product.path);
      await productPage.fillAccount(account);
    });

    test('OV-012 Voucher field and order detail are shown', { tag: TAG }, async ({ productPage, paymentDialog }) => {
      await productPage.selectDenomination(DENOM.superValuePass);

      await expect(paymentDialog.root).toContainText('Pakai voucher code biar makin hemat!');
      await expect(paymentDialog.voucherInput).toBeVisible();
      await expect(paymentDialog.applyButton).toBeVisible();
      await paymentDialog.expectOrderDetails(account, product.nickname, DENOM.superValuePass);
      await expect(paymentDialog.root).toContainText('Sistem Pembayaran');
      await expect(paymentDialog.root).toContainText('Total');
      await expect(paymentDialog.buyButton).toBeVisible();
    });

    test('OV-008 Change the denomination after a voucher is applied', { tag: TAG }, async ({ productPage, paymentDialog }) => {
      // Tanpa kode voucher valid: yang dicek, kode yang sudah diketik tidak terbawa ke denomination lain.
      await productPage.selectDenomination(DENOM.diamondA);
      // Kolom voucher baru aktif setelah metode pembayaran dipilih.
      await paymentDialog.selectPaymentMethod(PAYMENT_METHODS.qris);
      await paymentDialog.voucherInput.fill('SAVE10');
      await paymentDialog.close();

      await productPage.selectDenomination(DENOM.diamondB);
      await paymentDialog.expectOpenWithItem(DENOM.diamondB);
      await expect(paymentDialog.voucherInput).toHaveValue('');
    });

    test('OV-004 Buy without applying a voucher', { tag: CREATES_ORDER }, async ({ productPage, paymentDialog }) => {
      await productPage.selectDenomination(DENOM.smallestDiamond);
      await paymentDialog.selectPaymentMethod(PAYMENT_METHODS.qris);
      await expect(paymentDialog.voucherInput).toHaveValue('');

      await paymentDialog.buy();
      await paymentDialog.expectTransactionCode();
    });
  });

  test.describe('Manual', () => {
    const needsVoucher = 'Butuh kode voucher valid yang aktif di production.';
    manualCase('OV-001 Apply a valid voucher code', needsVoucher);
    manualCase('OV-005 Voucher code with extra spaces', needsVoucher);
    manualCase('OV-011 Invoice and email match Detail Pesanan', `${needsVoucher} Juga butuh order dan akses email.`);
    manualCase('OV-013 Account details stay the same after Apply', needsVoucher);
    manualCase('OV-014 Change payment method after Apply', needsVoucher);
    manualCase('OV-015 Buy uses the Total shown after Apply', `${needsVoucher} Juga membuat order sungguhan.`);
  });
});
