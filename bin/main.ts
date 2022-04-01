import { App } from "aws-cdk-lib";
import { RootPipelineStack } from "../lib/stacks/root-pipeline-stack";
import { StepFunctionTestStack } from '../lib/stacks/step-function-test-stack';

const app = new App();
new RootPipelineStack(app, "bh-pipeline-playground");
