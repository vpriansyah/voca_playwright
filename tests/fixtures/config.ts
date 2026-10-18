import { expect as baseExpect, type Page } from '@playwright/test';
import { ENV, requireEnv } from './env.ts';

/**
 * Data test, konstanta situs, dan helper dasar.
 *
 * Disusun mengikuti alur order:
 *   1. Situs & helper      buka halaman, tutup banner cookie
 *   2. Tipe data           bentuk Account, Product, PaymentMethod
 *   3. Akun                email & akun game yang dipakai test
 *   4. Produk              cari produk → buka halaman produk
 *   5. Denomination        item yang dipilih di halaman produk
 *   6. Pembayaran          metode bayar di dialog pembayaran
 *   7. Pesan validasi      teks error dari situs
 *   8. Data negatif        input tidak valid, urut sesuai alur di atas
 *
 * Ubah nilai di sini, bukan di file spec.
 * Fixture (`test`) ada di ./test.ts; page object ada di ../pages.
 */

// ─── 1. Situs & helper ───────────────────────────────────────────
// Origin mengikuti TEST_ENV (production / staging), lihat ./env.ts.
export { ENV };
export const LOCALE_HOME = '/id-id';

/** expect dengan timeout bawaan 20 detik. */
export const expect = baseExpect.configure({ timeout: 20_000 });

/** Buka path di bawah origin environment aktif, lalu tutup banner cookie. */
export async function openLocalePath(page: Page, path: string): Promise<void> {
  await page.goto(`${ENV.origin}${path}`, { waitUntil: 'domcontentloaded' });
  await dismissCookieBanner(page);
}

/** Tutup banner cookie yang muncul di kunjungan pertama, jika ada. */
async function dismissCookieBanner(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: 'Tolak Semua Cookie' })
    .click({ timeout: 8_000 })
    .catch(() => undefined);
}

// ─── 2. Tipe data ────────────────────────────────────────────────

/** Isi form akun di halaman produk. Field opsional hanya diisi jika ada. */
export type Account = {
  userId: string;
  zoneId?: string;
  email: string;
};

export type Product = {
  /** Kata kunci yang diketik di kolom "Cari" */
  searchKeyword: string;
  /** Accessible name link produk di hasil pencarian */
  productName: string;
  /** Path halaman produk, untuk dibuka langsung tanpa pencarian */
  path: string;
  /** Akun yang diisi di form, beserta nickname yang muncul setelah User ID dan Zone ID diisi */
  account: Account;
  nickname: string;
  /** Nama tombol denomination, mis. 'Weekly Diamond Pass' */
  denomination: string;
  /** Teks tombol harga denomination, mis. 'Rp 35,756' */
  price: string;
};

export type PaymentMethod = {
  /** Nama tombol grup di dialog pembayaran, mis. 'QRIS' atau 'E-Wallet' */
  group: string;
  /** Teks opsi di dalam grup, mis. 'QRIS' atau 'DANA' */
  option: string;
};

// ─── 3. Akun ─────────────────────────────────────────────────────
// Data pribadi tidak di-commit; diisi di .env (lihat .env.example) atau GitHub Secrets.
export const TEST_EMAIL = requireEnv('TEST_EMAIL');

// ─── 4. Produk ───────────────────────────────────────────────────
// Tambah produk: salin template di bawah, isi nilainya dari
// `npx playwright codegen https://vocagame.com`, lalu hapus komentarnya.
// Data di sini milik production; data staging menyusul.
export const PRODUCTS = {
  mobileLegends: {
    searchKeyword: 'mobile legend',
    productName: 'Mobile Legends: Bang Bang Mobile Legends: Bang Bang Moonton',
    path: '/id-id/mobile-legends-bang-bang',
    account: { userId: requireEnv('TEST_USER_ID'), zoneId: requireEnv('TEST_ZONE_ID'), email: TEST_EMAIL },
    nickname: requireEnv('TEST_NICKNAME'),
    denomination: 'Weekly Diamond Pass',
    price: 'Rp 35,756',
  },

  // TEMPLATE PRODUCT
  // namaProduk: {
  //   searchKeyword: '',
  //   productName: '',
  //   path: '/id-id/...',
  //   account: { userId: '', zoneId: '', email: TEST_EMAIL }, // hapus zoneId jika tidak ada
  //   nickname: '',
  //   denomination: '',
  //   price: '',
  // },
} satisfies Record<string, Product>;

// ─── 5. Denomination ─────────────────────────────────────────────
/** Nama tombol denomination Mobile Legends yang dipakai test case di CSV. */
export const ML_DENOMINATIONS = {
  // Diamond
  smallestDiamond: '5 Diamonds',
  diamondA: '5 Diamonds',
  diamondB: '10 Diamonds',
  largestDiamond: '28170 Diamonds',
  // Pass
  superValuePass: 'Super Value Pass',
  weeklyDiamondPass: 'Weekly Diamond Pass',
  twilightPass: 'Twilight Pass',
  // Limited Time Bundle
  bundles: ['Weekly Elite Bundle', 'Monthly Epic Bundle'],
  // 2x Recharge Bonus
  recharge: [
    '100 Diamonds (50+50) First Recharge',
    '300 Diamonds (150+150) First Recharge',
    '500 Diamonds (250+250) First Recharge',
  ],
} as const;

// ─── 6. Pembayaran ───────────────────────────────────────────────
/** Grup metode pembayaran yang tampil di dialog pembayaran, sesuai urutan di layar. */
export const PAYMENT_GROUPS = ['QRIS', 'Virtual Account', 'E-Wallet', 'Convenience Store'] as const;

// Tambah metode bayar: salin template di bawah. Jika tombol grup dan
// opsinya bernama sama (seperti QRIS), isi `group` dan `option` sama.
export const PAYMENT_METHODS = {
  qris: { group: 'QRIS', option: 'QRIS' },

  // TEMPLATE PAYMENT
  // namaMetode: { group: '', option: '' },
} satisfies Record<string, PaymentMethod>;

// ─── 7. Pesan validasi ───────────────────────────────────────────
// Teks dari situs, dipakai oleh negative case. Urut sesuai alur form.
export const VALIDATION_MESSAGES = {
  required: 'Input ini wajib diisi',
  accountNotFound: 'Akun yang anda masukkan tidak terdaftar',
  invalidEmail: 'Email harus berupa alamat email yang valid',
  paymentRequired: 'Silahkan pilih metode pembayaran terlebih dahulu',
} as const;

// ─── 8. Data negatif (dari CSV) ──────────────────────────────────
export const INVALID_DATA = {
  // Akun: User ID & Zone ID
  unregisteredAccount: { userId: '999999999', zoneId: '9999' },
  userIdLetters: 'abcdefgh',
  userIdSpecial: ['123@#456', '123 456 789'],
  zoneIdInvalid: ['ab12', '12-4', '12.4'],
  injection: ['<script>alert(1)</script>', "' OR '1'='1"],

  // Kontak: email / nomor HP
  emailFormats: ['budi@', 'budi.example.com', '@example.com', 'budi@@example.com'],
  emailPhones: ['0812', 'abc12345', '081234567890123456', '+++'],
  emailPhoneFormats: ['+6281234567890', '6281234567890', '081234567890'],
  emailInjection: ['<img src=x onerror=alert(1)>', "'; DROP TABLE users;--"],
  emailTooLong: `${'a'.repeat(288)}@example.com`,

  // Voucher
  voucherInvalid: 'XXXX9999',
  voucherInjection: '<script>alert(1)</script>',
} as const;
