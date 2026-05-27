const isNode = typeof window === "undefined";

const getEnvValue = (key, defaultValue = null) => {
	return import.meta.env[key] || defaultValue;
};

const getAppParams = () => {
	return {
		supabaseUrl: getEnvValue("VITE_SUPABASE_URL"),
		supabaseAnonKey: getEnvValue("VITE_SUPABASE_ANON_KEY"),
		fromUrl: isNode ? null : window.location.href,
	};
};

export const appParams = {
	...getAppParams(),
};