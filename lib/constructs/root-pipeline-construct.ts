
import { Construct } from "constructs";
import {
    aws_s3 as s3,
    aws_ssm as ssm,
    aws_stepfunctions as sfn,
    pipelines,
    RemovalPolicy,
    Duration,
    Stage
} from "aws-cdk-lib";
import { PushResourcesStep } from "../steps/pusher-step";
import { StepFunctionInvokeStep } from "../steps/step-function-invoke-step";
import { PipelineRunnerStepFunction } from "../constructs/pipeline-executioner-sf";

interface addSubPipelineOpts {
    pipelineName: string;
}

interface WaveResources {
    fileSet: pipelines.IFileSetProducer;
    assetBucket: s3.Bucket;
    stateMachine: sfn.StateMachine;
}

class SubPipelineSet extends pipelines.Wave {
    private fileSet: pipelines.IFileSetProducer;
    private assetBucket: s3.Bucket;
    private stateMachine: sfn.StateMachine;

    constructor(id: string, waveResources: WaveResources) {
        super(id);

        this.fileSet = waveResources.fileSet;
        this.assetBucket = waveResources.assetBucket;
        this.stateMachine = waveResources.stateMachine;
    };

    public addSubPipeline(stage: Stage, options: addSubPipelineOpts): void {

        const pushStep = new PushResourcesStep("Push", {
            input: this.fileSet,
            assetBucket: this.assetBucket,
            pipelineName: options.pipelineName,
        });

        const executePipelineStep = new StepFunctionInvokeStep("Execute", {
            stateMachine: this.stateMachine,
            stateMachineInput: {
                PipelineName: options.pipelineName,
            },
            incrementRunOrder: 1,
        });

        this.addStage(stage).addPost(pushStep, executePipelineStep);
    }

};

interface PipelineProps extends pipelines.CodePipelineProps {
    fileSet: pipelines.IFileSetProducer;
    assetBucket: s3.Bucket;
    stateMachine: sfn.StateMachine;
}

class Pipeline extends pipelines.CodePipeline {
    private isBuilt: boolean = false;
    private fileSet: pipelines.IFileSetProducer;
    private assetBucket: s3.Bucket;
    private stateMachine: sfn.StateMachine;

    constructor(scope: Construct, id: string, props: PipelineProps) {
        super(scope, id, props);

        this.fileSet = props.fileSet;
        this.assetBucket = props.assetBucket;
        this.stateMachine = props.stateMachine;

    };

    public buildPipeline(): void {
        if (this.isBuilt) {
            throw new Error('build() has already been called: can only call it once');
        }
        super.buildPipeline();
        this.isBuilt = true;
    }

    public addSubPipelineSet(id: string) {
        if (this.isBuilt) {
            throw new Error('addSubPipelineSet: can\'t add SubPipelineSets anymore after buildPipeline() has been called');
        }
        const fileSet = this.fileSet;
        const assetBucket = this.assetBucket;
        const stateMachine = this.stateMachine;

        const set = new SubPipelineSet(id, { fileSet, assetBucket, stateMachine });
        this.waves.push(set);
        return set;
    }
};

export interface RootPipelineProps {
    bucketParamName?: string;
    codeSource: pipelines.CodePipelineSource;
};

export class RootPipeline extends Construct {
    private readonly source: pipelines.CodePipelineSource;

    public readonly bucketParamName: string;
    public pipeline: Pipeline;
    public readonly sourceFileSet: pipelines.IFileSetProducer;

    constructor(scope: Construct, id: string, props: RootPipelineProps) {
        super(scope, id);

        this.bucketParamName = props.bucketParamName || "/RootPipeline/AssetBucketArn";
        this.source = props.codeSource;

        // this bucket will contain the cdk.out.zip file used by the subpipelines
        const sharedAssetsBucket = new s3.Bucket(this, "AssetBucket", {
            autoDeleteObjects: true,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: RemovalPolicy.DESTROY,
            lifecycleRules: [
                {
                    expiration: Duration.days(14),
                },
            ],
            versioned: true,
        });

        // if you try to pass the arn directly, cdk fails because the subpipeline cannot
        // depend on the root pipeline. But we can pass a static ssm parameter name.
        const bucketParam = new ssm.StringParameter(
            this,
            "AssestBucketParam",
            {
                parameterName: this.bucketParamName,
                stringValue: sharedAssetsBucket.bucketArn,
            }
        );

        const pipelineRunner = new PipelineRunnerStepFunction(
            this,
            "PipelineRunner",
            {}
        );

        // the synth step builds the cdk app
        const build = new pipelines.CodeBuildStep("SynthStep", {
            input: this.source,
            installCommands: ["npm install -g aws-cdk"],
            commands: ["npm ci", "npm run build", "npx cdk synth"],
        });

        this.sourceFileSet = build.addOutputDirectory("./");

        const codePipeline = new Pipeline(this, "RootPipeline", {
            synth: build,
            selfMutation: true,
            publishAssetsInParallel: false,
            assetBucket: sharedAssetsBucket,
            stateMachine: pipelineRunner.stateMachine,
            fileSet: this.sourceFileSet,
        });

        this.pipeline = codePipeline;
    };

};