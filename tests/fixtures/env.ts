import { existsSync } from 'node:fs';

/**
 * Pembagian environment: production dan staging.
 *
 * Pilih lewat TEST_ENV (default: production), dari terminal atau file .env:
 *   $env:TEST_ENV='staging'; npx playwright test
 * Variabel yang di-set di terminal mengalahkan isi .env. Contoh isi: .env.example.
 *
 * File ini tidak meng-import Playwright, supaya bisa dipakai oleh playwright.config.ts.
 */

if (existsSync('.env')) process.loadEnvFile('.env');

export type EnvName = 'production' | 'staging';

export type Environment = {
  name: EnvName;
  /** Origin situs tanpa garis miring di akhir */
  origin: string;
  /** false = browser terlihat; dibutuhkan jika Cloudflare memblokir headless (403 challenge) */
  headless: boolean;
  /** Jalankan test @creates-order (klik Buy) tanpa perlu RUN_ORDERS=1 */
  ordersByDefault: boolean;
};

const ENVIRONMENTS: Record<EnvName, Omit<Environment, 'name'>> = {
  production: {
    origin: 'https://vocagame.com',
    headless: true,
    ordersByDefault: true,
  },
  staging: {
    // STAGING_URL di .env / terminal menimpa URL ini.
    origin: process.env.STAGING_URL || 'https://staging.vocagame.dev',
    headless: true,
    ordersByDefault: true,
  },
};

function resolveEnvironment(): Environment {
  const name = (process.env.TEST_ENV || 'production').toLowerCase();
  if (!(name in ENVIRONMENTS)) {
    throw new Error(`TEST_ENV="${name}" tidak dikenal. Pilihan: ${Object.keys(ENVIRONMENTS).join(', ')}`);
  }
  const env = ENVIRONMENTS[name as EnvName];
  return { name: name as EnvName, ...env, origin: env.origin.replace(/\/+$/, '') };
}

export const ENV = resolveEnvironment();

/** Nilai wajib dari .env / terminal, mis. data akun yang tidak boleh ditulis di repo. */
export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} belum diisi. Salin .env.example menjadi .env, lalu isi ${name}.`);
  return value;
}

/** Test @creates-order jalan jika environment mengizinkan. RUN_ORDERS=1 / 0 selalu menimpa. */
export const RUN_ORDERS = process.env.RUN_ORDERS ? process.env.RUN_ORDERS === '1' : ENV.ordersByDefault;
