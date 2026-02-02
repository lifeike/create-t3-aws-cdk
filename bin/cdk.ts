#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { ToolchainStack } from "../lib/toolchain-stack";

const app = new cdk.App();

// Deploy only the toolchain stack for CI/CD pipeline
// The pipeline will create the production service stack automatically
new ToolchainStack(app, "ToolchainStack-Production", {
  env: {
    account: process.env.TOOLCHAIN_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.TOOLCHAIN_REGION || process.env.CDK_DEFAULT_REGION,
  },
  codecommitRepoName: "dmrv",
  branchName: "main",
});

app.synth();

