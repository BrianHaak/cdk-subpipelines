import { CdkWorkshopStack2 } from "../stacks/deploy-stack2";
import { Construct } from "constructs";
import { Stage, CfnOutput, StageProps } from "aws-cdk-lib";

interface workshopStageProps extends StageProps {
  environmentName: string | any;
}

export class WorkshopPipelineStage2 extends Stage {
  public readonly hcViewerUrl: CfnOutput;
  public readonly hcEndpoint: CfnOutput;

  constructor(scope: Construct, id: string, props?: workshopStageProps) {
    super(scope, id, props);

    const env = props?.environmentName;

    const service = new CdkWorkshopStack2(this, `${env}-WebService`, {
      environmentName: env,
    });
  }
}
