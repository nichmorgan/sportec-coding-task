import { Construct } from "constructs";
import {
  Duration,
  aws_lambda as lambda,
  aws_lambda_nodejs as lambdaNode,
} from "aws-cdk-lib";

interface CreateLambdaFunctionProps {
  environment?: Record<string, string>;
  layers?: lambda.ILayerVersion[];
  timeout?: Duration;
}

export function createLambdaFunction(
  scope: Construct,
  id: string,
  assetFolder: string,
  props?: CreateLambdaFunctionProps
) {
  return new lambdaNode.NodejsFunction(scope, id, {
    memorySize: 256,
    runtime: lambda.Runtime.NODEJS_18_X,
    entry: assetFolder,
    handler: "main",
    bundling: {
      minify: false,
    },
    ...props,
  });
}
