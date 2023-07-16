import { Construct } from "constructs";
import { Database } from "../common/database";
import {
  aws_lambda as lambda,
  aws_lambda_event_sources as lambda_event_sources,
} from "aws-cdk-lib";
import { createLambdaFunction } from "../helpers/lambda";

export interface MatchEventStreamProcessorProps {
  streamDatabase: Database;
  teamSummaryDatabase: Database;
  matchSummaryDatabase: Database;
}

export class MatchEventStreamProcessor extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props: MatchEventStreamProcessorProps
  ) {
    super(scope, id);

    const { streamDatabase, teamSummaryDatabase, matchSummaryDatabase } = props;

    const fn = createLambdaFunction(this, "handler", "stream.processor", {
      environment: {
        TEAM_SUMMARY_TABLE_NAME: teamSummaryDatabase.table.tableName,
        TEAM_SUMMARY_KEY_NAME: teamSummaryDatabase.pk,
        MATCH_SUMMARY_TABLE_NAME: matchSummaryDatabase.table.tableName,
        MATCH_SUMMARY_KEY_NAME: matchSummaryDatabase.pk,
      },
    });

    fn.addEventSource(
      new lambda_event_sources.DynamoEventSource(streamDatabase.table, {
        startingPosition: lambda.StartingPosition.TRIM_HORIZON,
        enabled: true,
        retryAttempts: 1, // TODO: make it better
        filters: [
          lambda.FilterCriteria.filter({
            eventName: lambda.FilterRule.isEqual("INSERT"),
          }),
        ],
      })
    );

    streamDatabase.table.grantStreamRead(fn).assertSuccess();
    teamSummaryDatabase.table.grantWriteData(fn).assertSuccess();
    matchSummaryDatabase.table.grantWriteData(fn).assertSuccess();
  }
}
