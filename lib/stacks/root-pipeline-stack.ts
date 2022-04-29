import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { EnvStage } from "../stages/env-pipeline-stage";
import { PushResourcesStep } from "../steps/pusher-step";
import { StepFunctionInvokeStep } from "../steps/step-function-invoke-step";
import { PipelineRunnerStepFunction } from "../constructs/pipeline-executioner-sf";
import {
  CodeBuildStep,
  CodePipeline,
  CodePipelineSource,
} from "aws-cdk-lib/pipelines";

export class RootPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // pipeline name needs to be static/predictable for the deployer action to work
    const pipelineNames = {
      dev1: "bhdev-subpipeline",
      dev2: "bhdev2-pipeline",
      qa: "bhqa-pipeline",
    };

    // this bucket will contain the cdk.out.zip file used by the subpipelines
    const sharedAssetsBucket = new cdk.aws_s3.Bucket(this, "AssetBucket", {
      autoDeleteObjects: true,
      blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(14),
        },
      ],
      versioned: true,
    });

    // if you try to pass the arn directly, cdk fails because the subpipeline cannot
    // depend on the root pipeline. But we can pass a static ssm parameter name.
    const bucketParmName = "/bh/root-pipeline-asset-bucket-arn";
    const bucketParam = new cdk.aws_ssm.StringParameter(
      this,
      "assestBucketParam",
      {
        parameterName: bucketParmName,
        stringValue: sharedAssetsBucket.bucketArn,
      }
    );

    const pipelineRunner = new PipelineRunnerStepFunction(
      this,
      "PipelineRunner",
      {}
    );

    // defines the github repo and branch to pull source from
    const source = CodePipelineSource.gitHub(
      "BrianHaak/cdk-subpipelines",
      "main",
      {
        authentication: cdk.SecretValue.secretsManager("brianhaak/gh_token", {
          jsonField: "github_token",
        }),
      }
    );

    // the synth step builds the cdk app
    const build = new CodeBuildStep("SynthStep", {
      input: source,
      installCommands: ["npm install -g aws-cdk"],
      commands: ["npm ci", "npm run build", "npx cdk synth", "pwd", "ls -la"],
    })
    
    const sourceFileSet = build.addOutputDirectory("./");

    const pipeline = new CodePipeline(this, "bh-Pipeline", {
      pipelineName: "bh-root-pipeline",
      synth: build,
      selfMutation: true,
      publishAssetsInParallel: false,
    });

    // each of these stages kick off the deployment of a sub pipeline.
    // you would have one for each account, region, and env+region combo.
    const deploydev1 = new EnvStage(this, "bhdev-Stage", {
      environmentName: "bhdev",
      bucketParam: bucketParmName,
      subPipelinename: pipelineNames.dev1,
    });

    const dev1pushStep = new PushResourcesStep("bhdev1-push", {
      input: sourceFileSet,
      assetBucket: sharedAssetsBucket,
      pipelineName: pipelineNames.dev1,
    });

    const sfd1 = new StepFunctionInvokeStep("bhdev1-sf", {
      stateMachine: pipelineRunner.stateMachine,
      stateMachineInput: {
        PipelineName: pipelineNames.dev1,
      },
      incrementRunOrder: 1,
    });

    const deploydev2 = new EnvStage(this, "bhdev2-Stage", {
      environmentName: "bhdev2",
      bucketParam: bucketParmName,
      subPipelinename: pipelineNames.dev2,
    });

    const dev2pushStep = new PushResourcesStep("bhdev2-push", {
      input: sourceFileSet,
      assetBucket: sharedAssetsBucket,
      pipelineName: pipelineNames.dev2,
    });

    const sfd2 = new StepFunctionInvokeStep("bhdev2-sf", {
      stateMachine: pipelineRunner.stateMachine,
      stateMachineInput: {
        PipelineName: pipelineNames.dev2,
      },
      incrementRunOrder: 1,
    });

    const deployqa = new EnvStage(this, "bhqa-Stage", {
      environmentName: "bhqa",
      bucketParam: bucketParmName,
      subPipelinename: pipelineNames.qa,
    });

    const qapushStep = new PushResourcesStep("bhqa-push", {
      input: sourceFileSet,
      assetBucket: sharedAssetsBucket,
      pipelineName: pipelineNames.qa,
    });

    const sfd3 = new StepFunctionInvokeStep("bhqa-sf", {
      stateMachine: pipelineRunner.stateMachine,
      stateMachineInput: {
        PipelineName: pipelineNames.qa,
      },
      incrementRunOrder: 1,
    });

    // waves can be used to group stages so that they are deployed in parallel
    const devDeployPipeWave = pipeline.addWave("bhdevPipes");
    devDeployPipeWave.addStage(deploydev1).addPost(dev1pushStep, sfd1);
    devDeployPipeWave.addStage(deploydev2).addPost(dev2pushStep, sfd2);

    const qaWave = pipeline.addWave("bhqaPipes");
    qaWave.addStage(deployqa).addPost(qapushStep, sfd3);
  }
}
