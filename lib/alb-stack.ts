import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { Vpc } from "./constructs/vpc";
import { AutoScalingGroup } from "./constructs/autoscaling-group";
import { Alb } from "./constructs/alb";
import { Route53HostedZone } from "./constructs/route53-hosted-zone";

export class AlbStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const zoneName = "web.non-97.net";

    // Route 53 Hosted Zone
    const hostedZone = new Route53HostedZone(this, "Route53HostedZone", {
      zoneName,
    });

    // VPC
    const vpc = new Vpc(this, "Vpc");

    // Auto Scaling group
    const asg = new AutoScalingGroup(this, "Asg", {
      vpc: vpc.vpc,
    });

    // ALB
    const alb = new Alb(this, "Alb", {
      vpc: vpc.vpc,
      asg: asg.asg,
      hostedZone: hostedZone.hostedZone,
    });
  }
}
