import { Construct } from "constructs";
import { aws_lambda as lambda } from "aws-cdk-lib";

interface createLambdaLayerProps {}

export function createLambdaLayer(
  scope: Construct,
  id: string,
  assetFolder: string,
  props?: createLambdaLayerProps
) {
  return new lambda.LayerVersion(scope, id, {
    compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
    code: lambda.Code.fromAsset(assetFolder),
    ...props,
  });
}
