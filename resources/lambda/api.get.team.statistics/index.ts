import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import {
  DynamoDBClient,
  GetItemCommand,
  GetItemCommandInput,
} from "@aws-sdk/client-dynamodb";
import { yup, schemas, enums, interfaces } from "/opt/shared";
import { DynamoAttributeValue } from "aws-cdk-lib/aws-stepfunctions-tasks";

const SettingsSchema = yup.object({
  TEAM_SUMMARY_TABLE: schemas.commonString.required(
    "TEAM_SUMMARY_TABLE envvar is required"
  ),
});

async function getTeamSummary(
  client: DynamoDBClient,
  tableName: string,
  team: string
): Promise<interfaces.TeamSummary | null> {
  const input: GetItemCommandInput = {
    TableName: tableName,
    Key: { team: DynamoAttributeValue.fromString(team).attributeValue },
  };

  const command = new GetItemCommand(input);
  const { Item } = await client.send(command);

  if (!Item) return null;

  return {
    total_matches: parseInt(Item.total_matches.N as string),
    total_wins: parseInt(Item.total_wins.N as string),
    total_draws: parseInt(Item.total_draws.N as string),
    total_losses: parseInt(Item.total_losses.N as string),
    total_goals_scored: parseInt(Item.total_goals_scored.N as string),
    total_goals_conceded: parseInt(Item.total_goals_conceded.N as string),
  };
}

export async function main(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const envvars: Record<string, string> = {
    TEAM_SUMMARY_TABLE: process.env.TEAM_SUMMARY_TABLE as string,
  };
  await SettingsSchema.validate(envvars);

  const team = event.pathParameters?.team_name as string;
  await schemas.commonString.required().validate(team);

  const ddbClient = new DynamoDBClient({});
  const statistics = await getTeamSummary(
    ddbClient,
    envvars.TEAM_SUMMARY_TABLE,
    team
  );

  return {
    statusCode: enums.StatusCodes.success,
    body: JSON.stringify({
      status: enums.ResponseStatuses.success,
      team,
      statistics,
    }),
  };
}
