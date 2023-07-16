import { Construct } from "constructs";
import { Database } from "../common/database";
import {
  aws_lambda as lambda,
  aws_lambda_event_sources as lambda_event_sources,
} from "aws-cdk-lib";
import { createLambdaFunction } from "../helpers/lambda";
import { enums } from "../../resources/shared";

export interface MatchEventStreamProcessorProps {
  teamSummaryDatabase: Database;
  matchSummaryDatabase: Database;
  matchEventsDatabase: Database;
}

export class MatchEventStreamProcessor extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props: MatchEventStreamProcessorProps
  ) {
    super(scope, id);

    const { teamSummaryDatabase, matchSummaryDatabase, matchEventsDatabase } =
      props;

    const fn = createLambdaFunction(this, "handler", "stream.processor", {
      environment: {
        TEAM_SUMMARY_TABLE_NAME: teamSummaryDatabase.table.tableName,
        TEAM_SUMMARY_KEY_NAME: teamSummaryDatabase.pk,
        MATCH_SUMMARY_TABLE_NAME: matchSummaryDatabase.table.tableName,
        MATCH_SUMMARY_KEY_NAME: matchSummaryDatabase.pk,
        MATCH_EVENTS_TABLE_NAME: matchEventsDatabase.table.tableName,
        MATCH_EVENTS_KEY_NAME: matchEventsDatabase.pk,
      },
    });

    fn.addEventSource(
      new lambda_event_sources.DynamoEventSource(matchEventsDatabase.table, {
        startingPosition: lambda.StartingPosition.TRIM_HORIZON,
        enabled: true,
        retryAttempts: 1, // TODO: make it better 🚑
        filters: [
          lambda.FilterCriteria.filter({
            eventName: lambda.FilterRule.isEqual("INSERT"),
            dynamodb: {
              NewImage: {
                event_type: {
                  S: lambda.FilterRule.or(
                    enums.MatchEventType.goal,
                    enums.MatchEventType.foul,
                    enums.MatchEventType.startMatch,
                    enums.MatchEventType.endMatch
                  ),
                },
              },
            },
          }),
        ],
      })
    );

    matchEventsDatabase.table.grantStreamRead(fn).assertSuccess();
    matchEventsDatabase.table.grantReadData(fn).assertSuccess();
    teamSummaryDatabase.table.grantReadWriteData(fn).assertSuccess();
    matchSummaryDatabase.table.grantReadWriteData(fn).assertSuccess();
  }
}
