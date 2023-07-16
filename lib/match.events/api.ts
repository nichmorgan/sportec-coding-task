import { Construct } from "constructs";
import { aws_apigateway as apigateway, aws_iam as iam } from "aws-cdk-lib";
import { StatusCodes } from "../../resources/shared/enums";
import { createLambdaFunction } from "../helpers/lambda";
import { createLambdaLayer } from "../helpers/layer";
import path = require("path");
import { Database } from "lib/common/database";

interface Props {
  database: Database;
}

export class MatchEventsApi extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const fn = createLambdaFunction(
      this,
      "handler",
      path.join(__dirname, "../../resources/lambda/ingest.processor/index.ts"),
      {
        layers: [
          createLambdaLayer(
            this,
            "shared",
            path.join(__dirname, "../../resources/shared")
          ),
        ],
        environment: {
          TABLE_NAME: props.database.table.tableName,
          KEY_NAME: props.database.pk,
        },
      }
    );

    const api = new apigateway.RestApi(this, "api");
    const ingestEndpoint = api.root.addResource("ingest");
    const credentialsRole = new iam.Role(this, "IntegrationRole", {
      assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
    });
    const integration = new apigateway.LambdaIntegration(fn, {
      credentialsRole,
    });

    ingestEndpoint.addMethod("POST", integration, {
      methodResponses: [
        { statusCode: StatusCodes.success.toString() },
        { statusCode: StatusCodes.badFormat.toString() },
      ],
    });

    fn.grantInvoke(credentialsRole).assertSuccess();
    props.database.table.grantWriteData(fn).assertSuccess();
  }
}
