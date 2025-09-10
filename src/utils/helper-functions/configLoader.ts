import { retrieveEnvVariables } from "./retrieveENVVariables";

let cachedConfig: any = null;

async function loadConfig(envName: string) {
  if (cachedConfig) return cachedConfig;

  const keys = [
    "MONGO_URI",
    "JWT_SECRET",
    "JWT_EXPIRES_IN",
    "JWT_REFRESH_SECRET",
    "JWT_REFRESH_EXPIRES_IN",
  ];

  const values = await retrieveEnvVariables(envName, keys);

  cachedConfig = {
    mongoUri: values.MONGO_URI,
    jwtSecret: values.JWT_SECRET,
    jwtExpiresIn: values.JWT_EXPIRES_IN,
    jwtRefreshSecret: values.JWT_REFRESH_SECRET,
    jwtRefreshExpiresIn: values.JWT_REFRESH_EXPIRES_IN,
  };

  return cachedConfig;
}

export { loadConfig };
