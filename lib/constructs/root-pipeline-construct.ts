
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

interface AddSubPipelineOpts {
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

    public addSubPipeline(stage: Stage, options: AddSubPipelineOpts) {
        const pushStep = new PushResourcesStep("PushSourceFiles", {
            input: this.fileSet,
            assetBucket: this.assetBucket,
            pipelineName: options.pipelineName,
        });

        const executePipelineStep = new StepFunctionInvokeStep("ExecuteSubPipeline", {
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
            throw new Error('buildPipeline() has already been called: can only call it once');
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
    codeSource?: pipelines.CodePipelineSource;
    buildStep?: pipelines.CodeBuildStep;
};

export class RootPipeline extends Construct {
    private readonly source: pipelines.CodePipelineSource;

    public pipeline: Pipeline;
    public readonly bucketParamName: string;
    public readonly sourceFileSet: pipelines.IFileSetProducer;

    constructor(scope: Construct, id: string, props: RootPipelineProps) {
        super(scope, id);

        this.bucketParamName = props.bucketParamName || `/${id}/AssetBucketArn`;

        if (!props.codeSource && !props.buildStep) throw new Error('RootPipeline: must specify either codeSource or buildStep');

        const build = props.buildStep || new pipelines.CodeBuildStep("SynthStep", {
            input: props.codeSource,
            installCommands: ["npm install -g aws-cdk"],
            commands: ["npm ci", "npm run build", "npx cdk synth"],
        });
        
        this.sourceFileSet = build.addOutputDirectory("./");

        // this bucket will contain the source.zip file used by the subpipelines
        const sharedAssetsBucket = new s3.Bucket(this, "AssetBucket", {
            autoDeleteObjects: true,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: RemovalPolicy.DESTROY,
            lifecycleRules: [
                {
                    expiration: Duration.days(14),
                    noncurrentVersionExpiration: Duration.days(3),
                },
            ],
            versioned: true,
        });

        // if you try to pass the arn directly, cdk fails because the subpipeline cannot
        // depend on the root pipeline. But we can pass a static ssm parameter name.
        new ssm.StringParameter(this, "AssestBucketParam", {
            parameterName: this.bucketParamName,
            stringValue: sharedAssetsBucket.bucketArn,
        }
        );

        const pipelineRunner = new PipelineRunnerStepFunction(this, "PipelineRunner", {});

        this.pipeline = new Pipeline(this, "RootPipeline", {
            synth: build,
            selfMutation: true,
            publishAssetsInParallel: false,
            assetBucket: sharedAssetsBucket,
            stateMachine: pipelineRunner.stateMachine,
            fileSet: this.sourceFileSet,
        });
    };

};