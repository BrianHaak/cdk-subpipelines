import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { HitCounter } from "../constructs/hello-lambda-construct";

interface CdkWorkshopStackProps extends cdk.StackProps {
  environmentName: string | any;
}

export class CdkWorkshopStack extends cdk.Stack {
  public readonly hcViewerUrl: cdk.CfnOutput;
  public readonly hcEndpoint: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props?: CdkWorkshopStackProps) {
    super(scope, id, props);

    const env = props?.environmentName;

    const hello = new lambda.Function(this, `${env}-HelloHandler`, {
      runtime: lambda.Runtime.NODEJS_14_X,
      code: lambda.Code.fromAsset("lambda"),
      handler: "hello.handler",
    });

    const helloWithCounter = new HitCounter(this, `${env}-HelloHitCounter`);
  }
}
