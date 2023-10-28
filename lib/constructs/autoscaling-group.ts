import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as fs from "fs";
import * as path from "path";

export interface AutoScalingGroupProps {
  vpc: cdk.aws_ec2.IVpc;
}

export class AutoScalingGroup extends Construct {
  readonly asg: cdk.aws_autoscaling.AutoScalingGroup;

  constructor(scope: Construct, id: string, props: AutoScalingGroupProps) {
    super(scope, id);

    // Assets
    const httpdAssets = new cdk.aws_s3_assets.Asset(this, "HttpdAssets", {
      path: path.join(__dirname, "../ec2/httpd"),
    });

    const tomcatAssets = new cdk.aws_s3_assets.Asset(this, "TomcatAssets", {
      path: path.join(__dirname, "../ec2/tomcat"),
    });

    // IAM Role
    const role = new cdk.aws_iam.Role(this, "Role", {
      assumedBy: new cdk.aws_iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        new cdk.aws_iam.ManagedPolicy(this, "Policy", {
          statements: [
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              resources: [
                `arn:aws:s3:::${httpdAssets.s3BucketName}/*`,
                `arn:aws:s3:::${tomcatAssets.s3BucketName}/*`,
              ],
              actions: ["s3:GetObject"],
            }),
          ],
        }),
      ],
    });

    // User data
    const userData = cdk.aws_ec2.UserData.forLinux();
    userData.addCommands(
      fs.readFileSync(
        path.join(__dirname, "../ec2/user-data/default.sh"),
        "utf8"
      )
    );
    userData.addS3DownloadCommand({
      bucket: httpdAssets.bucket,
      bucketKey: httpdAssets.s3ObjectKey,
      localFile: "/tmp/assets/httpd.zip",
    });
    userData.addS3DownloadCommand({
      bucket: tomcatAssets.bucket,
      bucketKey: tomcatAssets.s3ObjectKey,
      localFile: "/tmp/assets/tomcat.zip",
    });
    userData.addCommands(
      fs.readFileSync(
        path.join(__dirname, "../ec2/user-data/setting-packages.sh"),
        "utf8"
      )
    );

    this.asg = new cdk.aws_autoscaling.AutoScalingGroup(this, "Default", {
      machineImage: cdk.aws_ec2.MachineImage.lookup({
        name: "RHEL-9.2.0_HVM-20230905-x86_64-38-Hourly2-GP2",
        owners: ["309956199498"],
      }),
      instanceType: new cdk.aws_ec2.InstanceType("t3.micro"),
      blockDevices: [
        {
          deviceName: "/dev/sda1",
          volume: cdk.aws_autoscaling.BlockDeviceVolume.ebs(10, {
            volumeType: cdk.aws_autoscaling.EbsDeviceVolumeType.GP3,
            encrypted: true,
          }),
        },
      ],
      vpc: props.vpc,
      vpcSubnets: props.vpc.selectSubnets({
        subnetGroupName: "Public",
      }),
      maxCapacity: 1,
      minCapacity: 1,
      ssmSessionPermissions: true,
      userData,
      role,
      healthCheck: cdk.aws_autoscaling.HealthCheck.elb({
        grace: cdk.Duration.minutes(15),
      }),
    });
  }
}
