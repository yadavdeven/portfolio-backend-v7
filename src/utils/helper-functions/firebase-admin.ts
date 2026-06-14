import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { retrieveEnvVariables } from './retrieveENVVariables';

// Resolve the Firebase service-account credentials. Priority:
//   1. FIREBASE_SERVICE_ACCOUNT — the full JSON as a string. Resolved through the
//      same path as every other secret: SSM SecureString in Lambda, or process.env
//      (loaded from .env.*) locally. Preferred — no secret file in the bundle.
//   2. The JSON file next to the bundle root — local-dev / transitional fallback
//      for when the SSM parameter hasn't been provisioned yet.
//      dist/utils/helper-functions/ -> up 3 = root.
const loadServiceAccount = async (): Promise<admin.ServiceAccount> => {
  const envName = process.env.NODE_ENV || 'dev';
  const { FIREBASE_SERVICE_ACCOUNT } = await retrieveEnvVariables(envName, [
    { key: 'FIREBASE_SERVICE_ACCOUNT', secure: true },
  ]);

  // retrieveEnvVariables returns a `default-<key>` sentinel when the value is
  // missing — treat that as "not configured" and fall through to the file.
  if (
    FIREBASE_SERVICE_ACCOUNT &&
    FIREBASE_SERVICE_ACCOUNT !== 'default-FIREBASE_SERVICE_ACCOUNT'
  ) {
    return JSON.parse(FIREBASE_SERVICE_ACCOUNT);
  }

  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    path.join(
      __dirname,
      '../../../portfolioapp-b84ec-firebase-adminsdk-fbsvc-d7bbd3ddf4.json'
    );

  return JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
};

// Lazily initialize the Admin SDK on first use. Init is async now (the service
// account may come from SSM), so callers must `await getFirebaseAdmin()` instead
// of importing a ready instance. The `admin.apps.length` guard keeps it a
// singleton across warm Lambda invocations.
let initPromise: Promise<typeof admin> | null = null;

const getFirebaseAdmin = (): Promise<typeof admin> => {
  if (!initPromise) {
    initPromise = (async () => {
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(await loadServiceAccount()),
        });
      }
      return admin;
    })();
  }
  return initPromise;
};

export default getFirebaseAdmin;
