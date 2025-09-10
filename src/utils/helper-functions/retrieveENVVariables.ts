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

// Batch retrieval function
async function retrieveEnvVariables(
  envName: string,
  paramKeys: string[]
): Promise<Record<string, string>> {
  const env = process.env.NODE_ENV || envName || "dev";

  // Build full parameter paths
  const paramNames = paramKeys.map(
    (key) => `/portfolio/${env}/${key}`
  );

  const client = getSSMClient();

  // Fallback to process.env if not Lambda
  if (!client) {
    const result: Record<string, string> = {};
    for (const key of paramKeys) {
      result[key] = process.env[key.toUpperCase()] || `default-${key}`;
    }
    return result;
  }

  try {
    const command = new GetParametersCommand({
      Names: paramNames,
      WithDecryption: true,
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

    // Fill defaults for missing keys
    for (const key of paramKeys) {
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
