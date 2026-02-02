import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import { Construct } from "constructs";

export interface DatabaseProps {
  vpc: ec2.Vpc;
}

export class Database extends Construct {
  public readonly rdsInstance: rds.DatabaseInstance;

  constructor(scope: Construct, id: string, props: DatabaseProps) {
    super(scope, id);

    this.rdsInstance = new rds.DatabaseInstance(this, "PostgresDB", {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16_3,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T4G,
        ec2.InstanceSize.MICRO,
      ),
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      multiAz: false, // Set to true for production
      allocatedStorage: 20,
      maxAllocatedStorage: 100, // Enable storage autoscaling
      storageEncrypted: true,
      storageType: rds.StorageType.GP3, // Use GP3 for better performance/cost
      deletionProtection: false, // Set to true for production
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      credentials: rds.Credentials.fromGeneratedSecret("postgres", {
        secretName: "postgres-credentials",
      }),
    });
  }
}
