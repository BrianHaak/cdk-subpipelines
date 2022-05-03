import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { EnvStage } from "../stages/env-pipeline-stage";
import { RootPipeline } from '../constructs/root-pipeline-construct';
import {
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

    const bucketParamName = "/bh/root-pipeline-asset-bucket-arn";

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

    const rootPipeline = new RootPipeline(this, "RootPipeline", {
      bucketParamName: bucketParamName,
      codeSource: source,
    });

    // each of these stages kick off the deployment of a sub pipeline.
    // you would have one for each account, region, and env+region combo.
    const deploydev1 = new EnvStage(this, "bhdev-Stage", {
      environmentName: "bhdev",
      bucketParam: rootPipeline.bucketParamName,
      subPipelinename: pipelineNames.dev1,
    });

    const deploydev2 = new EnvStage(this, "bhdev2-Stage", {
      environmentName: "bhdev2",
      bucketParam: rootPipeline.bucketParamName,
      subPipelinename: pipelineNames.dev2,
    });

    const deployqa = new EnvStage(this, "bhqa-Stage", {
      environmentName: "bhqa",
      bucketParam: rootPipeline.bucketParamName,
      subPipelinename: pipelineNames.qa,
    });

    // waves can be used to group stages so that they are deployed in parallel
    const devDeployPipeWave = rootPipeline.pipeline.addSubPipelineSet("bhdevPipes");
    devDeployPipeWave.addSubPipeline(deploydev1, {pipelineName: pipelineNames.dev1});
    devDeployPipeWave.addSubPipeline(deploydev2, {pipelineName: pipelineNames.dev2});

    const qaWave = rootPipeline.pipeline.addSubPipelineSet("bhqaPipes");
    qaWave.addSubPipeline(deployqa, {pipelineName: pipelineNames.qa});
  }
}
