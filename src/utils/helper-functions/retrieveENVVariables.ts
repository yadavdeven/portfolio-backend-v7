import { SSMClient, GetParametersCommand } from "@aws-sdk/client-ssm";

let ssmClient: SSMClient | null = null;

// Initialize SSM client (only in Lambda)
function getSSMClient() {
  if (!process.env.AWS_EXECUTION_ENV) return null; // not running in Lambda
  if (!ssmClient) {
    ssmClient = new SSMClient({
      region: process.env.AWS_REGION || "ap-south-1", // use Lambda-injected region
    });
  }
  return ssmClient;
}

type ParamConfig = {
  key: string;
  secure?: boolean; // true = SecureString, false = String
};

// Batch retrieval function
async function retrieveEnvVariables(
  envName: string,
  paramConfigs: ParamConfig[]
): Promise<Record<string, string>> {
  const env = process.env.NODE_ENV || envName || "dev";

  const client = getSSMClient();

  // Build full paths
  const paramNames = paramConfigs.map((p) => `/portfolio/${env}/${p.key}`);

  // Fallback to process.env if not Lambda
  if (!client) {
    const result: Record<string, string> = {};
    for (const p of paramConfigs) {
      result[p.key] = process.env[p.key.toUpperCase()] || `default-${p.key}`;
    }
    return result;
  }

  try {
    const command = new GetParametersCommand({
      Names: paramNames,
      WithDecryption: true, // AWS SDK auto-handles both SecureString & String here
    });

    const response = await client.send(command);

    const result: Record<string, string> = {};

    // Fill from SSM
    if (response.Parameters) {
      response.Parameters.forEach((p) => {
        if (p.Name && p.Value) {
          const shortKey = p.Name.split("/").pop() as string;
          result[shortKey] = p.Value;
        }
      });
    }

    // Fill defaults for missing
    for (const { key } of paramConfigs) {
      if (!result[key]) {
        result[key] = `default-${key}`;
      }
    }

    return result;
  } catch (error) {
    console.error("Error retrieving parameters:", error);
    throw error;
  }
}

export { retrieveEnvVariables };
