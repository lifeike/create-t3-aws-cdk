import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import { Construct } from "constructs";
import { Database } from "../constructs/database";
import { Compute } from "../constructs/compute";

export interface ServiceStackProps extends cdk.StackProps {
  // Add any custom props here
}

export class ServiceStack extends cdk.Stack {
  public readonly apiEndpoint: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props?: ServiceStackProps) {
    super(scope, id, props);

    // Create VPC with cost optimization
    const vpc = new ec2.Vpc(this, "VPC", {
      maxAzs: 2,
      natGateways: 1, // Keep at 1 for cost optimization
      natGatewayProvider: ec2.NatProvider.instanceV2({
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.NANO),
      }), // Use smaller NAT instance instead of NAT Gateway for cost savings
      subnetConfiguration: [
        { name: "Public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: "Private", subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
        { name: "Database", subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });

    // -------------------
    // Route53 hosted zone
    // -------------------
    const hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
      domainName: "kxmercury.com",
    });

    // -------------------
    // ACM certificate
    // -------------------
    const certificate = new acm.Certificate(this, "Certificate", {
      domainName: "dmrv.kxmercury.com", // your subdomain
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    // Create database
    const database = new Database(this, "Database", { vpc });

    // Create compute (ECS)
    const compute = new Compute(this, "Compute", {
      vpc,
      database,
      certificate,
      domainName: "dmrv.kxmercury.com",
      hostedZone,
    });

    // Output the API endpoint
    this.apiEndpoint = new cdk.CfnOutput(this, "APIEndpoint", {
      value: `https://dmrv.kxmercury.com`,
      description: "Next.js application endpoint",
    });
  }
}
