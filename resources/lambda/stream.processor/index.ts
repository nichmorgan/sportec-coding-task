import { DynamoDBStreamEvent } from "aws-lambda";
import { SummaryDatabaseService } from "./database.service";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { enums, yup, schemas } from "/opt/shared";
import { SummaryService } from "./summary.service";
import * as R from "ramda";

const SettingsSchema = yup.object({
  MATCH_EVENTS_TABLE_NAME: schemas.commonString.required(
    "MATCH_EVENTS_TABLE_NAME envvar is required"
  ),
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
  MATCH_EVENTS_KEY_NAME: schemas.commonString.required(
    "MATCH_EVENTS_KEY_NAME envvar is required"
  ),
});

export async function main(event: DynamoDBStreamEvent) {
  const envvars: Record<string, string> = {
    MATCH_EVENTS_TABLE_NAME: process.env.MATCH_EVENTS_TABLE_NAME as string,
    MATCH_EVENTS_KEY_NAME: process.env.MATCH_EVENTS_KEY_NAME as string,
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
  const matchSummaryDatabaseService = new SummaryDatabaseService(ddbClient, {
    tableName: envvars.MATCH_SUMMARY_TABLE_NAME,
    keyName: envvars.MATCH_SUMMARY_KEY_NAME,
  });
  const matchEventsDatabaseService = new SummaryDatabaseService(ddbClient, {
    tableName: envvars.MATCH_EVENTS_TABLE_NAME,
    keyName: envvars.MATCH_EVENTS_KEY_NAME,
  });

  const summaryService = new SummaryService({
    teamDatabaseService,
    matchSummaryDatabaseService,
    matchEventsDatabaseService,
  });

  const promises = event.Records.map(async (record) => {
    console.log("Stream record: ", JSON.stringify(record, null, 2));
    const event = record.dynamodb?.NewImage;

    const event_type = R.path<string>(["event_type", "S"])(event) as string;
    const match_id = R.path<string>(["match_id", "S"])(event) as string;
    const team = R.path<string>(["team", "S"])(event) as string;
    const opponent = R.path<string>(["opponent", "S"])(event) as string;
    const timestamp = R.path<string>(["timestamp", "S"])(event) as string;

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
    await schemas.commonString
      .required("timestamp is required")
      .validate(timestamp);

    const registerProps = { team, opponent, match_id, timestamp };
    try {
      switch (event_type) {
        case enums.MatchEventType.goal:
          await summaryService.registerGoal(registerProps);
          break;
        case enums.MatchEventType.foul:
          await summaryService.registerFoul(registerProps);
          break;
        case enums.MatchEventType.startMatch:
          await summaryService.registerStartMatch(registerProps);
          break;
        case enums.MatchEventType.endMatch:
          await summaryService.registerEndMatch(registerProps);
          break;
        default:
          console.warn("Unexpected event type.", event_type, record);
          break;
      }
    } catch (error) {
      console.error("Unexpected error.", error);
    }
  });

  await Promise.all(promises);
}
