import { SubPipelineStack } from "../stacks/subpipeline-stack";
import { Construct } from "constructs";
import { Stage, StageProps } from "aws-cdk-lib";

interface workshopStageProps extends StageProps {
  environmentName: string | any;
  bucketParam: string;
  subPipelinename: string;
}

// A very simple stage that deploys a sub pipeline.
export class EnvStage extends Stage {
  constructor(scope: Construct, id: string, props: workshopStageProps) {
    super(scope, id, props);

    const env = props?.environmentName;
    const bucketParam = props.bucketParam;
    const pipelineName = props.subPipelinename;

    new SubPipelineStack(this, `${env}-PipelineStack`, {
      environmentName: env,
      bucketParam: bucketParam,
      pipelineName: pipelineName,
    });
  }
}
