import {
  Duration,
  aws_apigateway as apigateway,
  aws_iam as iam,
  aws_lambda as lambda,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { Database } from "../common/database";
import { createLambdaFunction } from "../helpers/lambda";
import { StatusCodes } from "../../resources/shared/enums";

interface MatchSummaryApiProps {
  matchEventsDatabase: Database;
  matchSummaryDatabase: Database;
  teamSummaryDatabase: Database;
}

interface CreateGetIntegrationProps {
  environment?: Record<string, string>;
  timeout?: Duration;
  method?: string;
  queryParams?: Record<string, boolean>;
  grantReadDatabase?: Database[];
}

export class MatchSummaryApi extends Construct {
  private readonly credentialsRole: iam.Role;
  private readonly api: apigateway.RestApi;
  private readonly matchEventsDatabase: Database;
  private readonly matchSummaryDatabase: Database;
  private readonly teamSummaryDatabase: Database;

  constructor(scope: Construct, id: string, props: MatchSummaryApiProps) {
    super(scope, id);

    Object.assign(this, props);
    this.api = new apigateway.RestApi(this, "api");
    this.credentialsRole = new iam.Role(this, "IntegrationRole", {
      assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
    });

    this.createGetIntegration(
      "getMatchListFn",
      "api.get.match.list",
      "matches",
      {
        environment: {
          MATCH_SUMMARY_TABLE: this.matchSummaryDatabase.table.tableName,
        },
        grantReadDatabase: [this.matchSummaryDatabase],
        queryParams: { limit: true, page: true },
      }
    );
    // this.createGetIntegration(
    //   "getMatchDetailsFn",
    //   "api.get.match.details",
    //   "matches/{match_id}"
    // );
    // this.createGetIntegration(
    //   "getMatchStatisticsFn",
    //   "api.get.match.statistics",
    //   "matches/{match_id}/statistics"
    // );
    // this.createGetIntegration(
    //   "getTeamStatisticsFn",
    //   "api.get.team.statistics",
    //   "teams/{team_name}/statistics"
    // );
  }

  private createGetIntegration(
    lambdaId: string,
    lambdaFolderName: string,
    endpoint: string,
    props?: CreateGetIntegrationProps
  ) {
    let methodRequestParameters: Record<string, boolean> = {};
    let integrationRequestParameters: Record<string, string> = {};

    const queryParams = props?.queryParams;
    if (queryParams) {
      Object.keys(queryParams).forEach((key) => {
        Object.assign(methodRequestParameters, {
          [`method.request.querystring.${key}`]: queryParams[key],
        });
        Object.assign(integrationRequestParameters, {
          [`integration.request.querystring.${key}`]: `method.request.querystring.${key}`,
        });
      });
    }

    const fn = createLambdaFunction(this, lambdaId, lambdaFolderName, {
      environment: props?.environment,
      timeout: props?.timeout,
    });
    const listMatchesIntegration = new apigateway.LambdaIntegration(fn, {
      credentialsRole: this.credentialsRole,
      requestParameters: integrationRequestParameters,
    });

    this.api.root
      .addResource(endpoint)
      .addMethod(props?.method ?? "GET", listMatchesIntegration, {
        methodResponses: [
          { statusCode: StatusCodes.success.toString() },
          { statusCode: StatusCodes.badFormat.toString() },
        ],
        requestParameters: methodRequestParameters,
      });

    fn.grantInvoke(this.credentialsRole).assertSuccess();
    if (props?.grantReadDatabase)
      props.grantReadDatabase.forEach((db) =>
        db.table.grantReadData(fn).assertSuccess()
      );
  }
}
