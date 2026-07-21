const ENVIRONMENTS = new Set(['development', 'test', 'ci', 'staging', 'production']);
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function clean(value) {
  return String(value || '').trim();
}

export function validateFrontendEnvironment({
  appEnvironment,
  supabaseUrl,
  supabaseAnonKey,
  expectedSupabaseHost,
  allowRemoteDevelopment = false,
}) {
  const name = clean(appEnvironment || 'development').toLowerCase();
  if (!ENVIRONMENTS.has(name)) {
    throw new Error(`Unsupported VITE_APP_ENV: ${name || '(empty)'}`);
  }

  const urlValue = clean(supabaseUrl);
  const keyValue = clean(supabaseAnonKey);
  if (!urlValue || !keyValue) {
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required.');
  }
  if (/service[_-]?role/i.test(keyValue)) {
    throw new Error('A service-role credential must never be exposed as VITE_SUPABASE_ANON_KEY.');
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(urlValue);
  } catch {
    throw new Error('VITE_SUPABASE_URL must be a valid absolute URL.');
  }

  const isLocal = LOCAL_HOSTS.has(parsedUrl.hostname);
  if (!isLocal && parsedUrl.protocol !== 'https:') {
    throw new Error('Remote Supabase environments must use HTTPS.');
  }

  if ((name === 'development' || name === 'test') && !isLocal && !allowRemoteDevelopment) {
    throw new Error(`${name} cannot use a remote Supabase project unless VITE_ALLOW_REMOTE_DEVELOPMENT=true.`);
  }

  const expectedHost = clean(expectedSupabaseHost).toLowerCase();
  if (name === 'staging' || name === 'production') {
    if (!expectedHost) {
      throw new Error(`VITE_EXPECTED_SUPABASE_HOST is required for ${name}.`);
    }
    if (parsedUrl.hostname.toLowerCase() !== expectedHost) {
      throw new Error(`${name} expected Supabase host ${expectedHost}, received ${parsedUrl.hostname}.`);
    }
    if (isLocal) throw new Error(`${name} cannot use a local Supabase URL.`);
  }

  return Object.freeze({
    name,
    supabaseUrl: parsedUrl.origin,
    supabaseAnonKey: keyValue,
    supabaseHost: parsedUrl.hostname.toLowerCase(),
    isLocal,
  });
}

export function resolveFrontendEnvironment(env) {
  return validateFrontendEnvironment({
    appEnvironment: env.VITE_APP_ENV,
    supabaseUrl: env.VITE_SUPABASE_URL,
    supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY,
    expectedSupabaseHost: env.VITE_EXPECTED_SUPABASE_HOST,
    allowRemoteDevelopment: env.VITE_ALLOW_REMOTE_DEVELOPMENT === 'true',
  });
}
