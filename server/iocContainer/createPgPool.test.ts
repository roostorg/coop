import { createPgPool } from './createPgPool.js';

describe('createPgPool', () => {
  test('attaches an idle-client `error` listener so pg errors do not crash the process', async () => {
    const pool = createPgPool({ host: '127.0.0.1', port: 1 });
    try {
      expect(pool.listenerCount('error')).toBeGreaterThan(0);
    } finally {
      await pool.end();
    }
  });

  test('logs and swallows idle-client errors instead of re-throwing', async () => {
    const pool = createPgPool({ host: '127.0.0.1', port: 1 });
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const simulatedError = new Error(
        'connection terminated unexpectedly (simulated)',
      );

      expect(() => pool.emit('error', simulatedError)).not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

      const loggedPayload = consoleErrorSpy.mock.calls[0]?.[0] as string;
      expect(typeof loggedPayload).toBe('string');
      expect(loggedPayload).toContain('Postgres pool idle-client error');
      expect(loggedPayload).toContain('connection terminated unexpectedly');
    } finally {
      consoleErrorSpy.mockRestore();
      await pool.end();
    }
  });

  test('forwards caller config to pg.Pool without mutating it', async () => {
    const config = { host: '127.0.0.1', port: 1, keepAlive: false };
    const snapshot = structuredClone(config);
    const pool = createPgPool(config);
    try {
      expect(config).toEqual(snapshot);
      expect(
        (pool as unknown as { options: { keepAlive?: boolean } }).options
          .keepAlive,
      ).toBe(false);
    } finally {
      await pool.end();
    }
  });
});
