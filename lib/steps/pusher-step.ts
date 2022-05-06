import { Stack } from 'aws-cdk-lib';
import {
  pipelines,
  aws_iam as iam,
  aws_s3 as s3
} from 'aws-cdk-lib';

export interface PushResourcesStepProps {
  input?: pipelines.IFileSetProducer | undefined;
  assetBucket: s3.Bucket;
  pipelineName: string
}

export class PushResourcesStep extends pipelines.CodeBuildStep {
  constructor(id: string, props: PushResourcesStepProps) {

    super(id, {
      input: props.input,
      commands: [
        "zip -r source.zip * -q", // the subpipelines s3 source action expects a zip file
        "aws s3 cp source.zip s3://$BUCKET_NAME/$PIPELINE_NAME/source.zip",
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
      ]
    });

  }
}
