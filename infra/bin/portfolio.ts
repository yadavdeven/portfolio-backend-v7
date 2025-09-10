#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { PortfolioStack } from "../lib/portfolio-stack";

const app = new cdk.App();

// Retrieve the environment name from context or default to "dev"
const envName = app.node.tryGetContext("env") || "dev";

if (!["dev", "prod"].includes(envName)) {
  throw new Error(`Invalid env '${envName}'. Must be 'dev' or 'prod'.`);
}

// Set the environment variables for the stack
new PortfolioStack(
  app,
  `Portfolio${envName.charAt(0).toUpperCase() + envName.slice(1)}Stack`,
  {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: "ap-south-1", // Change to your desired region
    },
    tags: {
      Environment: envName,
    },
  } satisfies cdk.StackProps
);
