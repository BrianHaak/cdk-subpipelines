import { CdkWorkshopStack } from "../stacks/deploy-stack";
import { Construct } from "constructs";
import { Stage, CfnOutput, StageProps } from "aws-cdk-lib";

interface workshopStageProps extends StageProps {
  environmentName: string | any;
}

export class WorkshopPipelineStage1 extends Stage {
  public readonly hcViewerUrl: CfnOutput;
  public readonly hcEndpoint: CfnOutput;

  constructor(scope: Construct, id: string, props?: workshopStageProps) {
    super(scope, id, props);

    const env = props?.environmentName;

    const service = new CdkWorkshopStack(this, `${env}-WebService`, {
      environmentName: env,
    });
  }
}
