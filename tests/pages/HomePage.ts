import type { Locator, Page } from '@playwright/test';
import { LOCALE_HOME, expect, openLocalePath } from '../fixtures/config.ts';

/** Homepage VocaGame: pencarian produk. */
export class HomePage {
  readonly searchInput: Locator;

  constructor(private readonly page: Page) {
    this.searchInput = page.getByRole('textbox', { name: 'Cari' });
  }

  async open(): Promise<void> {
    await openLocalePath(this.page, LOCALE_HOME);
  }

  /** Cari produk lewat kolom "Cari", lalu buka halaman produknya. */
  async openProduct(keyword: string, productName: string): Promise<void> {
    const productResult = this.page.getByRole('link', { name: productName });

    // Homepage kadang mengosongkan kolom Cari tepat setelah dimuat; isi ulang
    // sampai hasil pencarian muncul.
    await expect(async () => {
      await this.searchInput.click();
      await this.searchInput.fill(keyword);
      await expect(productResult).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 30_000 });

    await productResult.click();
  }
}
