import { isNcmecTestDeployment } from './ncmecEnv.js';

describe('isNcmecTestDeployment', () => {
  const original = process.env.NCMEC_ENV;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NCMEC_ENV;
    } else {
      process.env.NCMEC_ENV = original;
    }
  });

  it('returns true when NCMEC_ENV is unset', () => {
    delete process.env.NCMEC_ENV;
    expect(isNcmecTestDeployment()).toBe(true);
  });

  it('returns true when NCMEC_ENV is "test"', () => {
    process.env.NCMEC_ENV = 'test';
    expect(isNcmecTestDeployment()).toBe(true);
  });

  it('returns true when NCMEC_ENV is any non-production value', () => {
    process.env.NCMEC_ENV = 'staging';
    expect(isNcmecTestDeployment()).toBe(true);
  });

  it('returns false only when NCMEC_ENV is exactly "production"', () => {
    process.env.NCMEC_ENV = 'production';
    expect(isNcmecTestDeployment()).toBe(false);
  });
});
