import { webcrypto } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createAccount,
  generateRecoveryCode,
  verifyPin,
  verifyQuestions,
  verifyRecoveryCode,
} from '../src/security/local-security.js';

function useCrypto(value) {
  vi.stubGlobal('crypto', value);
}

describe('local-security', () => {
  beforeEach(() => {
    localStorage.clear();
    useCrypto(webcrypto);
  });

  it('creates and verifies PBKDF2 PIN verifiers', async () => {
    const { account } = await createAccount('uid-pbkdf2', '583214', [0, 1], ['Fluffy', 'Boston']);

    expect(account.pin.algorithm).toBe('PBKDF2-SHA-256');
    expect(account.pin.iterations).toBe(120000);
    expect(await verifyPin(account, '583214')).toBe(true);
    expect(await verifyPin(account, '583215')).toBe(false);
  });

  it('uses the weak-hash fallback when Web Crypto subtle is unavailable', async () => {
    useCrypto({
      getRandomValues(bytes) {
        bytes.fill(7);
        return bytes;
      },
    });

    const { account } = await createAccount('uid-weak', '824613', [0, 1], ['Fluffy', 'Boston']);

    expect(account.pin.algorithm).toBe('weak-fallback');
    expect(account.pin.iterations).toBe(0);
    expect(await verifyPin(account, '824613')).toBe(true);
    expect(await verifyPin(account, '824614')).toBe(false);
  });

  it('generates and verifies recovery codes, then rotates them', async () => {
    const code = generateRecoveryCode();
    expect(code).toMatch(/^CHR-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

    const { recoveryCode } = await createAccount('uid-recovery', '583214', [0, 1], ['Fluffy', 'Boston']);
    const replacement = await verifyRecoveryCode('uid-recovery', recoveryCode);

    expect(replacement).toMatch(/^CHR-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(replacement).not.toBe(recoveryCode);
    expect(await verifyRecoveryCode('uid-recovery', recoveryCode)).toBe(false);
  });

  it('locks security-question recovery after repeated failures', async () => {
    await createAccount('uid-questions', '583214', [0, 1], ['Fluffy', 'Boston']);

    await expect(verifyQuestions('uid-questions', ['wrong', 'answers'])).resolves.toEqual({ ok: false, remaining: 1 });
    const second = await verifyQuestions('uid-questions', ['wrong', 'answers']);

    expect(second.ok).toBe(false);
    expect(second.lockedUntil).toBeGreaterThan(Date.now());
    const locked = await verifyQuestions('uid-questions', ['fluffy', 'boston']);
    expect(locked.ok).toBe(false);
    expect(locked.lockedUntil).toBe(second.lockedUntil);
  });
});
