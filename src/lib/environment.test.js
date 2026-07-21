import { describe, expect, it } from 'vitest';
import { validateFrontendEnvironment } from './environment';

const base = {
  supabaseAnonKey: 'public-anon-test-key',
};

describe('frontend environment isolation', () => {
  it('allows local Supabase for development', () => {
    const result = validateFrontendEnvironment({
      ...base,
      appEnvironment: 'development',
      supabaseUrl: 'http://127.0.0.1:54321',
    });
    expect(result.isLocal).toBe(true);
    expect(result.name).toBe('development');
  });

  it('rejects accidental production use from development', () => {
    expect(() => validateFrontendEnvironment({
      ...base,
      appEnvironment: 'development',
      supabaseUrl: 'https://production.supabase.co',
    })).toThrow(/cannot use a remote Supabase project/i);
  });

  it('rejects staging when the expected project host differs', () => {
    expect(() => validateFrontendEnvironment({
      ...base,
      appEnvironment: 'staging',
      supabaseUrl: 'https://production.supabase.co',
      expectedSupabaseHost: 'staging.supabase.co',
    })).toThrow(/expected Supabase host/i);
  });

  it('accepts production only when its expected HTTPS host matches', () => {
    const result = validateFrontendEnvironment({
      ...base,
      appEnvironment: 'production',
      supabaseUrl: 'https://ark-one-production.supabase.co/rest/v1',
      expectedSupabaseHost: 'ark-one-production.supabase.co',
    });
    expect(result.supabaseUrl).toBe('https://ark-one-production.supabase.co');
  });

  it('rejects service-role credentials in frontend configuration', () => {
    expect(() => validateFrontendEnvironment({
      appEnvironment: 'production',
      supabaseUrl: 'https://ark-one-production.supabase.co',
      supabaseAnonKey: 'service_role_should_never_be_public',
      expectedSupabaseHost: 'ark-one-production.supabase.co',
    })).toThrow(/service-role credential/i);
  });
});
