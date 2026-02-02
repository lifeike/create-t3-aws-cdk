import * as cdk from "aws-cdk-lib";
import * as codecommit from "aws-cdk-lib/aws-codecommit";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as pipelines from "aws-cdk-lib/pipelines";
import { Construct } from "constructs";
import { ServiceStack } from "./stacks/service-stack";

export interface DeploymentPipelineProps {
  codecommitRepoName: string;
  branchName: string;
}

export class DeploymentPipeline extends Construct {
  constructor(scope: Construct, id: string, props: DeploymentPipelineProps) {
    super(scope, id);

    const source = pipelines.CodePipelineSource.codeCommit(codecommit.Repository.fromRepositoryName(this, "SourceRepo", props.codecommitRepoName), props.branchName);

    const synth = new pipelines.ShellStep("Synth", {
      input: source,
      commands: ["npm ci", "cd cdk && npm ci && cd ..", "npm install -g aws-cdk@2", "npm run build", "cd cdk && pwd && ls -la && npx cdk synth && cd ..", "mv cdk/cdk.out ./cdk.out"],
    });

    const pipeline = new pipelines.CodePipeline(this, "Pipeline", {
      codeBuildDefaults: {
        buildEnvironment: {
          buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
          computeType: codebuild.ComputeType.SMALL,
        },
        cache: codebuild.Cache.local(codebuild.LocalCacheMode.DOCKER_LAYER), // Add Docker layer caching
      },
      crossAccountKeys: true,
      publishAssetsInParallel: true, // Enable parallel asset publishing for faster builds
      synth,
    });

    this.addProductionStage(pipeline);
  }

  private addProductionStage(pipeline: pipelines.CodePipeline): void {
    const productionStage = new cdk.Stage(this, "Production", {
      env: {
        account: process.env.PRODUCTION_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.PRODUCTION_REGION || process.env.CDK_DEFAULT_REGION || "us-east-1",
      },
    });

    const serviceStack = new ServiceStack(productionStage, "ServiceStack-Production");

    const smokeTest = new pipelines.ShellStep("SmokeTest", {
      envFromCfnOutputs: {
        API_ENDPOINT: serviceStack.apiEndpoint,
      },
      commands: ["curl $API_ENDPOINT"],
    });

    pipeline.addStage(productionStage, { post: [smokeTest] });
  }
}
