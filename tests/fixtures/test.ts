import { test as base } from '@playwright/test';
import { HomePage } from '../pages/HomePage.ts';
import { PaymentDialog } from '../pages/PaymentDialog.ts';
import { ProductPage } from '../pages/ProductPage.ts';

export { expect } from './config.ts';

type Fixtures = {
  homePage: HomePage;
  productPage: ProductPage;
  paymentDialog: PaymentDialog;
  videoOnlyOnPass: void;
};

/**
 * `test` dengan page object sebagai fixture: spec cukup meminta `homePage`,
 * `productPage`, atau `paymentDialog` dan mendapat instance yang terikat ke `page`.
 */
export const test = base.extend<Fixtures>({
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  productPage: async ({ page }, use) => {
    await use(new ProductPage(page));
  },
  paymentDialog: async ({ page }, use) => {
    await use(new PaymentDialog(page));
  },

  /**
   * Playwright tidak punya mode "simpan video hanya jika lulus", jadi dengan
   * `video: 'on'` rekaman dihapus di sini saat test gagal. Context harus ditutup
   * dulu; video tidak bisa dihapus selama masih merekam.
   */
  videoOnlyOnPass: [
    async ({ page }, use, testInfo) => {
      await use();
      const video = page.video();
      if (video && testInfo.status !== testInfo.expectedStatus) {
        await page.context().close();
        await video.delete();
      }
    },
    // Timeout sendiri agar pembersihan tetap jalan saat test-nya timeout.
    { auto: true, timeout: 30_000 },
  ],
});

/**
 * Test case yang tidak bisa diotomatiskan lewat UI saja (payment gateway,
 * pengiriman in-game, email, modifikasi request, ...). Tampil sebagai "fixme"
 * di report beserta alasannya, agar setiap TC_ID dari test plan tetap tercatat.
 */
export function manualCase(title: string, reason: string): void {
  test.fixme(title, { tag: '@manual', annotation: { type: 'reason', description: reason } }, () => {});
}
