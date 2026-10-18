import type { Locator, Page } from '@playwright/test';
import { type Account, type PaymentMethod, expect } from '../fixtures/config.ts';

const RUPIAH = /Rp\s?[\d.,]+/;

/** Dialog pembayaran yang muncul setelah denomination dipilih. */
export class PaymentDialog {
  readonly root: Locator;
  readonly buyButton: Locator;
  readonly voucherInput: Locator;
  readonly applyButton: Locator;
  readonly transactionCode: Locator;

  constructor(private readonly page: Page) {
    this.root = page.getByRole('dialog');
    this.buyButton = this.root.getByRole('button', { name: 'Buy' });
    this.voucherInput = this.root.getByPlaceholder('Input Voucher Code');
    this.applyButton = this.root.getByRole('button', { name: 'Apply' });
    this.transactionCode = page.locator('span').filter({ hasText: /^TXN/ });
  }

  async expectOpenWithItem(itemName: string): Promise<void> {
    await expect(this.root).toBeVisible();
    await expect(this.root).toContainText(itemName);
    await expect(this.root).toContainText(RUPIAH);
  }

  async expectOrderDetails(account: Account, nickname: string, itemName: string): Promise<void> {
    await expect(this.root).toContainText('Detail Pesanan');
    await expect(this.root).toContainText(itemName);
    await expect(this.root).toContainText(account.email);
    await expect(this.root).toContainText(nickname);
    // Ditampilkan tanpa spasi, mis. "12345678(1234)".
    const playerId = account.zoneId ? `${account.userId}(${account.zoneId})` : account.userId;
    await expect(this.root).toContainText(playerId);
  }

  /** Tutup dialog dengan Escape; jika tidak tertutup, klik area di luar dialog. */
  async close(): Promise<void> {
    await this.page.keyboard.press('Escape');
    if (await this.root.isVisible()) await this.page.mouse.click(5, 5);
    await expect(this.root).toBeHidden();
  }

  /** Nilai "Total" di Detail Pesanan, mis. 'Rp 35,756'. */
  async total(): Promise<string> {
    const text = (await this.root.textContent()) ?? '';
    const matches = [...text.matchAll(/Total\s*(Rp\s?[\d.,]+)/g)];
    expect(matches.length, 'Total tidak ditemukan di dialog pembayaran').toBeGreaterThan(0);
    return matches[matches.length - 1][1];
  }

  paymentGroup(group: string): Locator {
    return this.root.getByRole('button', { name: group });
  }

  /** Buka grup metode pembayaran, lalu pilih opsi di dalamnya. */
  async selectPaymentMethod({ group, option }: PaymentMethod): Promise<void> {
    await expect(this.paymentGroup(group)).toBeVisible();
    await this.paymentGroup(group).click();
    await this.page.getByRole('region', { name: group }).getByText(option).click();
  }

  /** Pilih opsi pertama dalam grup, untuk grup yang nama opsinya belum dipetakan. */
  async selectFirstOptionIn(group: string): Promise<void> {
    await this.paymentGroup(group).click();
    const region = this.page.getByRole('region', { name: group });
    await expect(region).toBeVisible();
    await region.getByRole('img').first().click();
  }

  async applyVoucher(code: string): Promise<void> {
    await this.voucherInput.fill(code);
    await this.applyButton.click();
  }

  async expectBuyDisabled(): Promise<void> {
    await expect(this.buyButton).toBeDisabled();
  }

  async expectBuyEnabled(): Promise<void> {
    await expect(this.buyButton).toBeEnabled();
  }

  async buy(): Promise<void> {
    await this.expectBuyEnabled();
    await this.buyButton.click();
  }

  async expectTransactionCode(): Promise<void> {
    await expect(this.transactionCode).toBeVisible({ timeout: 30_000 });
  }

  async readTransactionCode(): Promise<string> {
    await this.expectTransactionCode();
    return (await this.transactionCode.first().innerText()).trim();
  }
}
