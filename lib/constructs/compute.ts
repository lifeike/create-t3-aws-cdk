import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import { Construct } from "constructs";
import { Database } from "./database";

export interface ComputeProps {
  vpc: ec2.Vpc;
  database: Database;
  certificate?: acm.Certificate;
  domainName?: string;
  hostedZone?: route53.IHostedZone;
}

export class Compute extends Construct {
  public readonly ecsService: ecsPatterns.ApplicationLoadBalancedFargateService;

  constructor(scope: Construct, id: string, props: ComputeProps) {
    super(scope, id);

    // Create ECS cluster
    const cluster = new ecs.Cluster(this, "Cluster", {
      vpc: props.vpc,
    });

    // Create Fargate service with load balancer
    this.ecsService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, "NextJsService", {
      cluster,
      memoryLimitMiB: 512, // Reduced from 1024 - Next.js typically needs less
      cpu: 256, // Reduced from 512 - more cost effective
      taskSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      taskImageOptions: {
        image: ecs.ContainerImage.fromAsset("../"),
        containerPort: 3000,
        environment: {
          NODE_ENV: "production",
          DB_HOST: props.database.rdsInstance.instanceEndpoint.hostname,
          DB_PORT: props.database.rdsInstance.instanceEndpoint.port.toString(),
          DB_NAME: "postgres", // Default database name for PostgreSQL
          AUTH_TRUST_HOST: "true",
          AUTH_URL: "https://dmrv.kxmercury.com", // Use your actual domain
          // TODO: Move these to Secrets Manager for production
          AUTH_SECRET: "your-auth-secret-here",
          AUTH_GITHUB_ID: "your-github-client-id",
          AUTH_GITHUB_SECRET: "your-github-client-secret",
          AUTH_DISCORD_ID: "your-discord-client-id",
          AUTH_DISCORD_SECRET: "your-discord-client-secret",
        },
        secrets: {
          DB_USERNAME: ecs.Secret.fromSecretsManager(props.database.rdsInstance.secret!, "username"),
          DB_PASSWORD: ecs.Secret.fromSecretsManager(props.database.rdsInstance.secret!, "password"),
          // Note: You'll need to manually create these secrets in AWS Secrets Manager
          // or add them as environment variables for now
        },
        logDriver: ecs.LogDrivers.awsLogs({
          streamPrefix: "nextjs-app",
          logRetention: 7, // Keep logs for 7 days to reduce costs
        }),
      },
      desiredCount: 1, // Start with 1 instance
      publicLoadBalancer: true,
      certificate: props.certificate,
      domainName: props.domainName,
      domainZone: props.hostedZone,
    });

    // Configure auto scaling
    const scalableTarget = this.ecsService.service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 10,
    });

    scalableTarget.scaleOnCpuUtilization("CpuScaling", {
      targetUtilizationPercent: 70,
    });

    scalableTarget.scaleOnMemoryUtilization("MemoryScaling", {
      targetUtilizationPercent: 80,
    });

    // Allow ECS to connect to RDS
    props.database.rdsInstance.connections.allowDefaultPortFrom(this.ecsService.service);
  }
}
