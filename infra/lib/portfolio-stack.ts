import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

export class PortfolioStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const envName = this.node.tryGetContext("env") || "dev";

    // 🔐 Secure SSM parameters (stored as SecureString in SSM)
    const mongoUriParam =
      ssm.StringParameter.fromSecureStringParameterAttributes(
        this,
        "MongoUriParam",
        { parameterName: `/portfolio/${envName}/MONGO_URI` }
      );

    const jwtSecretParam =
      ssm.StringParameter.fromSecureStringParameterAttributes(
        this,
        "JwtSecretParam",
        { parameterName: `/portfolio/${envName}/JWT_SECRET` }
      );

    const jwtRefreshSecretParam =
      ssm.StringParameter.fromSecureStringParameterAttributes(
        this,
        "JwtRefreshSecretParam",
        { parameterName: `/portfolio/${envName}/JWT_REFRESH_SECRET` }
      );

    // Firebase service-account JSON (whole file stored as one SecureString).
    const firebaseServiceAccountParam =
      ssm.StringParameter.fromSecureStringParameterAttributes(
        this,
        "FirebaseServiceAccountParam",
        { parameterName: `/portfolio/${envName}/FIREBASE_SERVICE_ACCOUNT` }
      );

    // 🔓 Non-sensitive SSM parameters (plain String)
    const jwtExpiresInParam = ssm.StringParameter.fromStringParameterName(
      this,
      "JwtExpiresInParam",
      `/portfolio/${envName}/JWT_EXPIRES_IN`
    );

    const jwtRefreshExpiresInParam =
      ssm.StringParameter.fromStringParameterName(
        this,
        "JwtRefreshExpiresInParam",
        `/portfolio/${envName}/JWT_REFRESH_EXPIRES_IN`
      );

    // 🚀 Define Lambda
    const portfolioLambda = new lambda.Function(this, "PortfolioLambda", {
      runtime: lambda.Runtime.NODEJS_22_X,
      code: lambda.Code.fromAsset("../", {
        exclude: [
          "infra/**",
          "cdk.out/**",
          ".git/**",
          ".env*",
          "*.md",
          "tsconfig.json",
          "test/**",
          "*.ts",
          // Firebase credentials come from SSM at runtime — never ship the key.
          "*firebase-adminsdk*.json",
        ],
      }),
      handler: "dist/handler.handler",
      timeout: cdk.Duration.seconds(30),
      memorySize: 128,
      environment: {
        NODE_ENV: envName,
        PORT: "5005",
        MONGO_URI_PARAM: `/portfolio/${envName}/MONGO_URI`,
        JWT_SECRET_PARAM: `/portfolio/${envName}/JWT_SECRET`,
        JWT_EXPIRES_IN_PARAM: `/portfolio/${envName}/JWT_EXPIRES_IN`,
        JWT_REFRESH_SECRET_PARAM: `/portfolio/${envName}/JWT_REFRESH_SECRET`,
        JWT_REFRESH_EXPIRES_IN_PARAM: `/portfolio/${envName}/JWT_REFRESH_EXPIRES_IN`,
      },
    });

    // ✅ Grant permissions (includes kms:Decrypt for SecureStrings)
    mongoUriParam.grantRead(portfolioLambda);
    jwtSecretParam.grantRead(portfolioLambda);
    jwtRefreshSecretParam.grantRead(portfolioLambda);
    jwtExpiresInParam.grantRead(portfolioLambda);
    jwtRefreshExpiresInParam.grantRead(portfolioLambda);
    firebaseServiceAccountParam.grantRead(portfolioLambda);

    // 🌐 API Gateway
    const api = new apigateway.LambdaRestApi(this, `PortfolioApi-${envName}`, {
      handler: portfolioLambda,
      proxy: true,
      deployOptions: { stageName: envName },
    });

    // 📣 Output endpoint
    new cdk.CfnOutput(this, "ApiEndpoint", {
      value: api.url,
      description: `API Gateway endpoint for portfolio app - ${envName}`,
    });
  }
}
