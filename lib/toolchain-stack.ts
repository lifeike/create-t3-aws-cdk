import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { DeploymentPipeline } from "./deployment-pipeline";

export interface ToolchainStackProps extends cdk.StackProps {
  codecommitRepoName: string;
  branchName: string;
}

export class ToolchainStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ToolchainStackProps) {
    super(scope, id, props);

    // Create deployment pipeline
    new DeploymentPipeline(this, "DeploymentPipeline", { codecommitRepoName: props.codecommitRepoName, branchName: props.branchName });
  }
}
