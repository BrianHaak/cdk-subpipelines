import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

export class HitCounter extends Construct {
  public readonly handler: lambda.Function;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.handler = new lambda.Function(this, `${id}-HelloHandler2`, {
      runtime: lambda.Runtime.NODEJS_14_X,
      code: lambda.Code.fromAsset("lambda"),
      handler: "hello.handler",
    });
  }
}
