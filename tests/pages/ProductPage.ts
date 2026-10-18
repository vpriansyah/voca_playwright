import type { Locator, Page } from '@playwright/test';
import { type Account, expect, openLocalePath } from '../fixtures/config.ts';

/** Halaman produk game: form akun, kontak, dan pilihan denomination. */
export class ProductPage {
  readonly userIdInput: Locator;
  readonly zoneIdInput: Locator;
  readonly emailInput: Locator;
  readonly paymentDialog: Locator;
  readonly categoryTabs: Locator;
  /** Kartu denomination: tombol yang berisi tombol harga "Rp ..." */
  readonly denominationCards: Locator;

  constructor(private readonly page: Page) {
    this.userIdInput = this.accountField('*User ID');
    this.zoneIdInput = this.accountField('*Zone ID');
    this.emailInput = page.getByRole('textbox', { name: '*Email' });
    this.paymentDialog = page.getByRole('dialog');
    this.categoryTabs = page.getByRole('button', { name: /^button tabs / });
    this.denominationCards = page
      .getByRole('button')
      .filter({ has: page.getByRole('button', { name: /^Rp / }) });
  }

  /** Production: spinbutton "*User ID"; staging: textbox "*User ID Kamu". */
  private accountField(label: string): Locator {
    return this.page.getByRole('spinbutton', { name: label }).or(this.page.getByRole('textbox', { name: label }));
  }

  /** Buka halaman produk langsung lewat URL. */
  async open(path: string): Promise<void> {
    await openLocalePath(this.page, path);
    await expect(this.userIdInput).toBeVisible();
  }

  async fillAccount(account: Account): Promise<void> {
    await this.fillUntilKept([
      [this.userIdInput, account.userId],
      [this.zoneIdInput, account.zoneId],
      [this.emailInput, account.email],
    ]);
  }

  /** Isi User ID dan Zone ID saja (email dibiarkan). */
  async fillPlayer(userId: string, zoneId?: string): Promise<void> {
    await this.fillUntilKept([
      [this.userIdInput, userId],
      [this.zoneIdInput, zoneId],
    ]);
  }

  async fillEmail(email: string): Promise<void> {
    await this.emailInput.fill(email);
  }

  async expectAccount(account: Account): Promise<void> {
    await expect(this.userIdInput).toHaveValue(account.userId);
    if (account.zoneId !== undefined) await expect(this.zoneIdInput).toHaveValue(account.zoneId);
    await expect(this.emailInput).toHaveValue(account.email);
  }

  /**
   * Ketik per karakter seperti pengguna, setelah mengosongkan field.
   * Input angka membuang karakter yang bukan digit, jadi pakai ini (bukan fill)
   * untuk menguji apa yang benar-benar diterima field.
   */
  async typeInto(field: Locator, text: string): Promise<void> {
    await this.clear(field);
    await this.page.keyboard.type(text);
  }

  /** Tempel teks sekaligus (seperti paste), setelah mengosongkan field. */
  async pasteInto(field: Locator, text: string): Promise<void> {
    await this.clear(field);
    await this.page.keyboard.insertText(text);
  }

  /** Field akun tidak pernah "stable" bagi Playwright, jadi pakai focus, bukan click. */
  private async clear(field: Locator): Promise<void> {
    await field.focus();
    await this.page.keyboard.press('ControlOrMeta+A');
    await this.page.keyboard.press('Backspace');
  }

  /** Pindah fokus keluar field agar validasi blur berjalan. */
  async blur(): Promise<void> {
    await this.page.keyboard.press('Tab');
  }

  async expectNickname(nickname: string): Promise<void> {
    await expect(this.page.getByText(nickname, { exact: true }).first()).toBeVisible();
  }

  /** Pesan bisa muncul di bawah field dan sebagai toast sekaligus. */
  async expectMessage(message: string): Promise<void> {
    await expect(this.page.getByText(message).first()).toBeVisible();
  }

  async expectNoMessage(message: string): Promise<void> {
    await expect(this.page.getByText(message)).toHaveCount(0);
  }

  card(name: string): Locator {
    return this.page.getByRole('button', { name, exact: true });
  }

  /** Harga yang tertulis di kartu denomination, mis. 'Rp 35,756'. */
  async cardPrice(name: string): Promise<string> {
    const price = this.card(name).getByRole('button', { name: /^Rp / });
    await expect(price).toBeVisible();
    return (await price.innerText()).trim();
  }

  /**
   * Sebelum halaman produk selesai dimuat, kartu belum menampilkan harga dan
   * tab kategori belum ada; klik di area denomination memunculkannya.
   * Panggil saat form akun masih kosong agar dialog pembayaran tidak terbuka.
   */
  async revealDenominationCards(name: string): Promise<void> {
    if (!(await this.categoryTabs.first().isVisible())) await this.card(name).click();
    await expect(this.categoryTabs.first()).toBeVisible();
  }

  /** Pilih denomination sampai dialog pembayaran terbuka. */
  async selectDenomination(name: string): Promise<void> {
    await this.clickDenomination(name);
    await expect(this.paymentDialog).toBeVisible();
  }

  /** Negative case: dialog pembayaran tidak boleh terbuka dan pesan error harus tampil. */
  async expectDenominationRejected(name: string, message: string): Promise<void> {
    await this.clickDenomination(name);
    await this.expectMessage(message);
    await expect(this.paymentDialog).toBeHidden();
  }

  /**
   * Jika halaman belum selesai dimuat, klik pertama hanya memunculkan kartu
   * lengkap dan kartu perlu diklik lagi; jika sudah, klik pertama langsung
   * memproses pilihan.
   */
  private async clickDenomination(name: string): Promise<void> {
    const tabsWereVisible = await this.categoryTabs.first().isVisible();
    await this.card(name).click();
    if (tabsWereVisible) return;

    await expect(this.paymentDialog.or(this.categoryTabs.first())).toBeVisible();
    if (!(await this.paymentDialog.isVisible())) await this.card(name).click();
  }

  /**
   * Halaman produk mengosongkan form sekali setelah tampil (biasanya ~1 detik,
   * kadang lebih lama); nilai yang diisi sebelum itu hilang. Isi, tunggu, lalu
   * isi ulang sampai nilainya bertahan.
   */
  private async fillUntilKept(fields: Array<[Locator, string | undefined]>): Promise<void> {
    const toFill = fields.filter((entry): entry is [Locator, string] => entry[1] !== undefined);
    await expect(this.userIdInput).toBeVisible();
    await this.page.waitForTimeout(3_000);

    await expect(async () => {
      for (const [field, value] of toFill) await field.fill(value);
      await this.page.waitForTimeout(1_500);
      for (const [field, value] of toFill) await expect(field).toHaveValue(value, { timeout: 0 });
    }).toPass({ timeout: 60_000 });
  }
}
