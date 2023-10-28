import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export interface AlbProps {
  vpc: cdk.aws_ec2.IVpc;
  asg: cdk.aws_autoscaling.AutoScalingGroup;
  hostedZone: cdk.aws_route53.IHostedZone;
}

export class Alb extends Construct {
  readonly alb: cdk.aws_elasticloadbalancingv2.IApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props: AlbProps) {
    super(scope, id);

    const certificate = new cdk.aws_certificatemanager.Certificate(
      this,
      "CertificateSample1",
      {
        domainName: `sample1.${props.hostedZone.zoneName}`,
        validation: cdk.aws_certificatemanager.CertificateValidation.fromDns(
          props.hostedZone
        ),
      }
    );

    // ALB
    this.alb = new cdk.aws_elasticloadbalancingv2.ApplicationLoadBalancer(
      this,
      "Default",
      {
        vpc: props.vpc,
        internetFacing: true,
        vpcSubnets: {
          subnets: props.vpc.publicSubnets,
        },
      }
    );
    props.asg.connections.allowFrom(this.alb, cdk.aws_ec2.Port.tcp(80));

    // Target Group
    const targetGroup =
      new cdk.aws_elasticloadbalancingv2.ApplicationTargetGroup(
        this,
        "TargetGroup",
        {
          vpc: props.vpc,
          port: 80,
          targetType: cdk.aws_elasticloadbalancingv2.TargetType.INSTANCE,
          targets: [props.asg],
          deregistrationDelay: cdk.Duration.seconds(10),
          healthCheck: {
            path: "/tomcat",
            interval: cdk.Duration.seconds(10),
          },
        }
      );

    // Listener
    this.alb.addListener("ListenerHttps", {
      port: 443,
      protocol: cdk.aws_elasticloadbalancingv2.ApplicationProtocol.HTTPS,
      certificates: [certificate],
      sslPolicy: cdk.aws_elasticloadbalancingv2.SslPolicy.RECOMMENDED_TLS,
      defaultTargetGroups: [targetGroup],
    });

    this.alb.addListener("ListenerHttp", {
      port: 80,
      protocol: cdk.aws_elasticloadbalancingv2.ApplicationProtocol.HTTP,
      defaultAction: cdk.aws_elasticloadbalancingv2.ListenerAction.redirect({
        protocol: "HTTPS",
        port: "443",
        permanent: true,
      }),
    });

    // Alias
    new cdk.aws_route53.ARecord(this, "AliasSample1", {
      zone: props.hostedZone,
      recordName: `sample1.${props.hostedZone.zoneName}`,
      target: cdk.aws_route53.RecordTarget.fromAlias(
        new cdk.aws_route53_targets.LoadBalancerTarget(this.alb)
      ),
    });
  }
}
