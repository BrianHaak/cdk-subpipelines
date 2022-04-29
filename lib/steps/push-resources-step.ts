import { Construct } from 'constructs';
import { StackProps } from 'aws-cdk-lib';
import {
  pipelines,
  aws_iam as iam,
  aws_s3 as s3
} from 'aws-cdk-lib';

interface PushResourcesStepProps extends StackProps {
  input?: pipelines.IFileSetProducer | undefined;
  assetBucket: s3.Bucket;
  pipelineName: string
}

export class PushResourcesStep extends Construct {
  public readonly step: pipelines.CodeBuildStep;

  constructor(scope: Construct, id: string, props: PushResourcesStepProps) {
    super(scope, id);

    this.step = new pipelines.CodeBuildStep("pusher", {
      input: props.input,
      commands: [
        // "ls -la",
        // "mkdir files",
        // "mv * files || true",
        // "mv files cdk.out", // the subpipelines synth step looks for a folder called cdk.out, thus we need to move the files there
        "zip -r cdk.out.zip cdk.out", // the subpipelines s3 source action expects a zip file
        "aws s3 cp cdk.out.zip s3://$BUCKET_NAME/$PIPELINE_NAME/cdk.out.zip",
      ],
      env: {
        BUCKET_NAME: props.assetBucket.bucketName,
        PIPELINE_NAME: props.pipelineName,
      },
      rolePolicyStatements: [
        new iam.PolicyStatement({
          actions: [
            "s3:GetObject*",
            "s3:GetBucket*",
            "s3:List*",
            "s3:Put*",
            "s3:Abort*",
            "s3:DeleteObject",
          ],
          resources: [`${props.assetBucket.bucketArn}/*`],
        }),
      ],
    });

  }

}