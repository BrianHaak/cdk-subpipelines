import {Stack, StackProps} from "aws-cdk-lib";
import { Construct } from "constructs";
import { PipelineRunnerStepFunction } from "../constructs/pipeline-executioner-sf";

export class StepFunctionTestStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const sf = new PipelineRunnerStepFunction(this, 'PipelineRunner', {});

  }
}
