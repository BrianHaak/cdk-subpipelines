import {
  pipelines,
  aws_codepipeline_actions as cpactions,
  aws_codepipeline as codepipeline,
  aws_stepfunctions as sfn,
} from "aws-cdk-lib";

export interface StepFunctionInvokeProps {
  /**
   * The StateMachine to invoke
   */
  readonly stateMachine: sfn.StateMachine;

  /**
   * The input payload to pass to the StateMachine execution
   */
  readonly stateMachineInput: object;

  /**
   * Bumps the runorder of this step in the stage
   *
   * @default 0
   */
  readonly incrementRunOrder?: number;
}

/**
 * Pipeline step that invokes a state machine
 */
export class StepFunctionInvokeStep
  extends pipelines.Step
  implements pipelines.ICodePipelineActionFactory
{
  readonly stateMachine: sfn.StateMachine;
  readonly stateMachineInput: object;
  readonly incrementRunOrder: number;

  constructor(id: string, props: StepFunctionInvokeProps) {
    super(id);

    this.stateMachine = props.stateMachine;
    this.stateMachineInput = props.stateMachineInput;
    this.incrementRunOrder = props.incrementRunOrder || 0;
  }

  public produceAction(
    stage: codepipeline.IStage,
    options: pipelines.ProduceActionOptions
  ): pipelines.CodePipelineActionFactoryResult {
    stage.addAction(
      new cpactions.StepFunctionInvokeAction({
        stateMachine: this.stateMachine,
        runOrder: options.runOrder + this.incrementRunOrder,
        actionName: options.actionName,
        stateMachineInput: cpactions.StateMachineInput.literal(
          this.stateMachineInput
        ),
      })
    );

    return { runOrdersConsumed: 1 };
  }
}
