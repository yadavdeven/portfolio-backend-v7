import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

export class PortfolioStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const envName = this.node.tryGetContext("env") || "dev";

    const mongoUriParam = ssm.StringParameter.fromStringParameterName(
      this,
      "MongoUriParam",
      `/portfolio/${envName}/MONGO_URI`
    );

    const jwtSecretParam = ssm.StringParameter.fromStringParameterName(
      this,
      "JwtSecretParam",
      `/portfolio/${envName}/JWT_SECRET`
    );

    const jwtExpiresInParam = ssm.StringParameter.fromStringParameterName(
      this,
      "JwtExpiresInParam",
      `/portfolio/${envName}/JWT_EXPIRES_IN`
    );

    const jwtRefreshSecretParam = ssm.StringParameter.fromStringParameterName(
      this,
      "JwtRefreshSecretParam",
      `/portfolio/${envName}/JWT_REFRESH_SECRET`
    );

    const jwtRefreshExpiresInParam =
      ssm.StringParameter.fromStringParameterName(
        this,
        "JwtRefreshExpiresInParam",
        `/portfolio/${envName}/JWT_REFRESH_EXPIRES_IN`
      );

    // Define the Lambda function
    const portfolioLambda = new lambda.Function(this, "PortfolioLambda", {
      runtime: lambda.Runtime.NODEJS_22_X,
      code: lambda.Code.fromAsset("../", {
        exclude: [
          "infra/**", // infra folder is not needed
          "cdk.out/**", // prevent recursive asset copying
          ".git/**", // don’t package git metadata
          ".env*", // ignore local env files
          "*.md",
          "tsconfig.json",
          "test/**", // optional: skip tests
          "*.ts", // ship only built JS, not TS sources
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

    // Grant Lambda permission to read parameters
    mongoUriParam.grantRead(portfolioLambda);
    jwtSecretParam.grantRead(portfolioLambda);
    jwtExpiresInParam.grantRead(portfolioLambda);
    jwtRefreshSecretParam.grantRead(portfolioLambda);
    jwtRefreshExpiresInParam.grantRead(portfolioLambda);

    // Define API Gateway
    const api = new apigateway.LambdaRestApi(this, `PortfolioApi-${envName}`, {
      handler: portfolioLambda,
      proxy: true,
      deployOptions: { stageName: envName },
    });

    // Output API endpoint
    new cdk.CfnOutput(this, "ApiEndpoint", {
      value: api.url,
      description: `API Gateway endpoint URL for portfolio app - ${envName}`,
    });
  }
}
