import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { WorkshopPipelineStage1 } from "../stages/env-stage1";
import { WorkshopPipelineStage2 } from "../stages/env-stage2";
import {
  CodeBuildStep,
  CodePipeline,
  CodePipelineSource,
} from "aws-cdk-lib/pipelines";

interface workshopPipelineProps extends cdk.StackProps {
  environmentName: string | any;
  bucketParam: string;
  pipelineName: string;
}

export class SubPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: workshopPipelineProps) {
    super(scope, id, props);

    const env = props.environmentName;
    const bucketParam = props.bucketParam;
    const pipelineName = props.pipelineName;

    // the subpipeline needs to get the bucket arn for the cdk.out assets that were generated
    // by the synth step in the root pipeline.
    const assetBucketArn = cdk.aws_ssm.StringParameter.fromStringParameterName(
      this,
      `${id}-assetbucketparam`,
      bucketParam
    ).stringValue;

    const bucket = cdk.aws_s3.Bucket.fromBucketArn(
      this,
      `${id}-assetbucket`,
      assetBucketArn
    );

    // sub pipeline. It needs a synth step that results in a cdk.out.zip file.
    // however, since this uses an s3 source, it is simply pulling that asset.
    // thus no additional processing is needed
    const pipeline = new CodePipeline(this, `${id}-pipeline`, {
      codePipeline: new cdk.aws_codepipeline.Pipeline(
        this,
        `${id}-codePipeline`,
        {
          restartExecutionOnUpdate: false, // we don't want the subpipeline to run on update because the cdk.out assests for this deployment won't be in s3 yet.
          pipelineName: pipelineName,
        }
      ),
      selfMutation: false,
      publishAssetsInParallel: false,
      synth: new CodeBuildStep(`${env}-Synth`, {
        input: CodePipelineSource.s3(bucket, `${pipelineName}/source.zip`, {
          trigger: cdk.aws_codepipeline_actions.S3Trigger.NONE, // this can be turned off if the pipeline execution is triggered by the root pipeline deployer action
        }),
        commands: ["ls -la", "cd source"], // don't actually have to do anything since the cdk project was already synthed
      }),
    });

    // these stages are the ones that actually contain your apps stacks.
    const deploydev1 = new WorkshopPipelineStage1(
      this,
      `${env}-stage1-deploy`,
      {
        environmentName: env,
      }
    );

    const deploydev2 = new WorkshopPipelineStage2(
      this,
      `${env}-stage2-deploy`,
      {
        environmentName: env,
      }
    );

    pipeline.addStage(deploydev1);

    pipeline.addStage(deploydev2);
  }
}
