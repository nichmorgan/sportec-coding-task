import { DynamoDBStreamEvent } from "aws-lambda";
import { SummaryDatabaseService } from "./database.service";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { enums, yup, schemas } from "/opt/shared";
import { SummaryService } from "./summary.service";
import * as R from "ramda";

const SettingsSchema = yup.object({
  TEAM_SUMMARY_TABLE_NAME: schemas.commonString.required(
    "TEAM_SUMMARY_TABLE_NAME envvar is required"
  ),
  MATCH_SUMMARY_TABLE_NAME: schemas.commonString.required(
    "MATCH_SUMMARY_TABLE_NAME envvar is required"
  ),
  TEAM_SUMMARY_KEY_NAME: schemas.commonString.required(
    "TEAM_SUMMARY_KEY_NAME envvar is required"
  ),
  MATCH_SUMMARY_KEY_NAME: schemas.commonString.required(
    "MATCH_SUMMARY_KEY_NAME envvar is required"
  ),
});

export async function main(event: DynamoDBStreamEvent) {
  const envvars: Record<string, string> = {
    TEAM_SUMMARY_TABLE_NAME: process.env.TEAM_SUMMARY_TABLE_NAME as string,
    TEAM_SUMMARY_KEY_NAME: process.env.TEAM_SUMMARY_KEY_NAME as string,
    MATCH_SUMMARY_TABLE_NAME: process.env.MATCH_SUMMARY_TABLE_NAME as string,
    MATCH_SUMMARY_KEY_NAME: process.env.MATCH_SUMMARY_KEY_NAME as string,
  };
  await SettingsSchema.validate(envvars);

  const ddbClient = new DynamoDBClient({});
  const teamDatabaseService = new SummaryDatabaseService(ddbClient, {
    tableName: envvars.TEAM_SUMMARY_TABLE_NAME,
    keyName: envvars.TEAM_SUMMARY_KEY_NAME,
  });
  const matchDatabaseService = new SummaryDatabaseService(ddbClient, {
    tableName: envvars.MATCH_SUMMARY_TABLE_NAME,
    keyName: envvars.MATCH_SUMMARY_KEY_NAME,
  });

  const summaryService = new SummaryService({
    teamDatabaseService,
    matchDatabaseService,
  });

  const promises = event.Records.map(async (record) => {
    console.log("Stream record: ", JSON.stringify(record, null, 2));
    const event = record.dynamodb?.NewImage;

    const event_type = R.path<string>(["event_type", "S"])(event) as string;
    const match_id = R.path<string>(["match_id", "S"])(event) as string;
    const team = R.path<string>(["team", "S"])(event) as string;
    const opponent = R.path<string>(["opponent", "S"])(event) as string;

    await schemas.commonString
      .required("event_type is required")
      .validate(event_type);
    await schemas.commonString
      .required("match_id is required")
      .validate(match_id);
    await schemas.commonString.required("team is required").validate(team);
    await schemas.commonString
      .required("opponent is required")
      .validate(opponent);

    switch (event_type) {
      case enums.MatchEventType.goal:
        await summaryService.registerGoal({ team, opponent, match_id });
        break;
      case enums.MatchEventType.foul:
        break;
      default:
        break;
    }
  });

  await Promise.all(promises);
}
