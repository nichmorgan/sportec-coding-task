import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import {
  DynamoDBClient,
  GetItemCommand,
  GetItemCommandInput,
} from "@aws-sdk/client-dynamodb";
import { yup, schemas, enums, interfaces } from "/opt/shared";
import { DynamoAttributeValue } from "aws-cdk-lib/aws-stepfunctions-tasks";

const SettingsSchema = yup.object({
  MATCH_SUMMARY_TABLE: schemas.commonString.required(
    "MATCH_SUMMARY_TABLE envvar is required"
  ),
});

async function getMatchSummary(
  client: DynamoDBClient,
  tableName: string,
  match_id: string
): Promise<interfaces.IMatchSummary | null> {
  const input: GetItemCommandInput = {
    TableName: tableName,
    Key: { match_id: DynamoAttributeValue.fromString(match_id).attributeValue },
  };

  const command = new GetItemCommand(input);
  const { Item } = await client.send(command);

  if (!Item) return null;

  return {
    opponent: Item.opponent.S as string,
    team: Item.team.S as string,
    total_fouls: parseInt(Item.total_fouls.N as string),
    total_goals: parseInt(Item.total_goals.N as string),
    date: Item.date.S as string,
  };
}

export async function main(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const envvars: Record<string, string> = {
    MATCH_SUMMARY_TABLE: process.env.MATCH_SUMMARY_TABLE as string,
  };
  await SettingsSchema.validate(envvars);

  const match_id = event.pathParameters?.match_id as string;
  await schemas.commonString.required().validate(match_id);

  const ddbClient = new DynamoDBClient({});
  const statistics = await getMatchSummary(
    ddbClient,
    envvars.MATCH_SUMMARY_TABLE,
    match_id
  );

  return {
    statusCode: enums.StatusCodes.success,
    body: JSON.stringify({
      status: enums.ResponseStatuses.success,
      match_id,
      statistics,
    }),
  };
}
