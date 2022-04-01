import { Construct } from "constructs";
import { Duration, StackProps } from "aws-cdk-lib";
import {
  aws_stepfunctions_tasks as tasks,
  aws_stepfunctions as sfn,
} from "aws-cdk-lib";

/**
 * Step Function that executes and monitors a CodePipeline.
 *
 * input for the Step Function:
 * {
 *   "PipelineName": "my-pipeline",
 * }
 */
export class PipelineRunnerStepFunction extends Construct {
  public readonly stateMachine: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id);

    const start = new tasks.CallAwsService(this, "StartExecution", {
      service: "codepipeline",
      action: "startPipelineExecution",
      iamResources: ["arn:aws:codepipeline:*"],
      parameters: {
        "Name.$": "$.PipelineName",
      },
      resultPath: "$.startExecutionResult",
    });

    const wait = new sfn.Wait(this, "WaitForExecution", {
      time: sfn.WaitTime.duration(Duration.seconds(30)),
    });

    const check = new tasks.CallAwsService(this, "GetExecution", {
      service: "codepipeline",
      action: "getPipelineExecution",
      iamResources: ["arn:aws:codepipeline:*"],
      parameters: {
        "PipelineExecutionId.$": "$.startExecutionResult.PipelineExecutionId",
        "PipelineName.$": "$.PipelineName",
      },
      resultPath: "$.getExecutionResult",
    });

    const pass = new sfn.Pass(this, "Pass");
    const fail = new sfn.Fail(this, "Fail");

    const choice = new sfn.Choice(this, "Choice")
      .when(
        sfn.Condition.stringEquals(
          "$.getExecutionResult.PipelineExecution.Status",
          "InProgress"
        ),
        wait
      )
      .when(
        sfn.Condition.stringEquals(
          "$.getExecutionResult.PipelineExecution.Status",
          "Succeeded"
        ),
        pass
      )
      .otherwise(fail);

    const definition = start.next(wait).next(check).next(choice);

    this.stateMachine = new sfn.StateMachine(this, "StateMachine", {
      stateMachineName: "PipelineRunner",
      definition,
    });
  }
}
