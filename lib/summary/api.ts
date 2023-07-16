import {
  Duration,
  aws_apigateway as apigateway,
  aws_iam as iam,
  aws_dynamodb as dynamodb,
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
  urlParams?: string[];
  grantReadDatabase?: dynamodb.ITable[];
}

export class MatchSummaryApi extends Construct {
  private readonly api: apigateway.RestApi;
  private readonly matchEventsDatabase: Database;
  private readonly matchSummaryDatabase: Database;
  private readonly teamSummaryDatabase: Database;

  constructor(scope: Construct, id: string, props: MatchSummaryApiProps) {
    super(scope, id);

    Object.assign(this, props);
    this.api = new apigateway.RestApi(this, "api", {
      description: "MatchSummaryApi",
    });

    this.createGetIntegration(
      "getMatchListFn",
      "api.get.match.list",
      "/matches",
      {
        environment: {
          MATCH_SUMMARY_TABLE: this.matchSummaryDatabase.table.tableName,
        },
        grantReadDatabase: [this.matchSummaryDatabase.table],
        queryParams: { limit: true, page: true },
      }
    );

    this.createGetIntegration(
      "getMatchDetailsFn",
      "api.get.match.details",
      "/matches/{match_id}",
      {
        environment: {
          MATCH_EVENTS_TABLE: this.matchEventsDatabase.table.tableName,
        },
        grantReadDatabase: [this.matchEventsDatabase.table],
        urlParams: ["match_id"],
      }
    );
    this.createGetIntegration(
      "getMatchStatisticsFn",
      "api.get.match.statistics",
      "/matches/{match_id}/statistics",
      {
        environment: {
          MATCH_SUMMARY_TABLE: this.matchSummaryDatabase.table.tableName,
        },
        grantReadDatabase: [this.matchSummaryDatabase.table],
        urlParams: ["match_id"],
      }
    );
    this.createGetIntegration(
      "getTeamStatisticsFn",
      "api.get.team.statistics",
      "/teams/{team_name}/statistics",
      {
        environment: {
          TEAM_SUMMARY_TABLE: this.teamSummaryDatabase.table.tableName,
        },
        grantReadDatabase: [this.teamSummaryDatabase.table],
        urlParams: ["team_name"],
      }
    );
  }

  private createGetIntegration(
    lambdaId: string,
    lambdaFolderName: string,
    fullPath: string,
    props?: CreateGetIntegrationProps
  ) {
    const resource = this.api.root.resourceForPath(fullPath);
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

    const urlParams = props?.urlParams;
    if (urlParams) {
      urlParams.forEach((key) => {
        Object.assign(methodRequestParameters, {
          [`method.request.path.${key}`]: true,
        });
        Object.assign(integrationRequestParameters, {
          [`integration.request.path.${key}`]: `method.request.path.${key}`,
        });
      });
    }

    const fn = createLambdaFunction(this, lambdaId, lambdaFolderName, {
      environment: props?.environment,
      timeout: props?.timeout ?? Duration.seconds(5),
    });
    const credentialsRole = new iam.Role(this, `${lambdaId}IntegrationRole`, {
      assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
    });
    const integration = new apigateway.LambdaIntegration(fn, {
      credentialsRole,
      requestParameters: integrationRequestParameters,
    });

    resource.addMethod(props?.method ?? "GET", integration, {
      methodResponses: [
        { statusCode: StatusCodes.success.toString() },
        { statusCode: StatusCodes.badFormat.toString() },
      ],
      requestParameters: methodRequestParameters,
    });

    fn.grantInvoke(credentialsRole).assertSuccess();
    if (props?.grantReadDatabase)
      props.grantReadDatabase.forEach((table) =>
        table.grantReadData(fn).assertSuccess()
      );
  }
}
