import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { yup, schemas, enums, interfaces } from "/opt/shared";
import {
  DynamoDBClient,
  ScanCommand,
  ScanCommandInput,
} from "@aws-sdk/client-dynamodb";
import { ISuccessResponseMatch } from "./interfaces";
import * as R from "ramda";

const SettingsSchema = yup.object({
  MATCH_EVENTS_TABLE: schemas.commonString.required(
    "MATCH_EVENTS_TABLE envvar is required"
  ),
});

async function getMatchEvents(
  client: DynamoDBClient,
  tableName: string,
  match_id: string
): Promise<ISuccessResponseMatch | null> {
  const input: ScanCommandInput = {
    TableName: tableName,
    ExpressionAttributeNames: {
      "#match_id": "match_id",
    },
    ExpressionAttributeValues: {
      ":val": { S: match_id },
    },
    FilterExpression: "#match_id = :val",
  };

  const command = new ScanCommand(input);
  const result = await client.send(command);

  if (result.Items?.length) {
    const { timestamp, team, opponent } = result.Items[0];
    const events: interfaces.IMatchEventDetails[] = [];

    console.log(result.Items);
    result.Items.forEach((item) => {
      let input: Record<string, unknown> = {};
      if (item.event_details.M) {
        R.forEachObjIndexed((value, key, obj) => {
          const attrVal = value.N
            ? parseFloat(value.N)
            : value.NULL
            ? null
            : R.values(value)[0];

          input = {
            ...input,
            [key]: attrVal,
          };
          console.log(value, key, input);
        }, item.event_details.M);
      }

      if (Object.keys(input).length) {
        events.push(input as interfaces.IMatchEventDetails);
        console.log("input", input, events);
      } else console.warn("Ignoring event without details", item);
    });

    return {
      match_id,
      opponent: opponent.S as string,
      team: team.S as string,
      date: timestamp.S as string,
      events,
    };
  }

  return null;
}

export async function main(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const envvars: Record<string, string> = {
    MATCH_EVENTS_TABLE: process.env.MATCH_EVENTS_TABLE as string,
  };
  await SettingsSchema.validate(envvars);

  const match_id = event.pathParameters?.match_id as string;
  await schemas.commonString
    .required("match_id is required")
    .validate(match_id);

  const ddbClient = new DynamoDBClient({});
  const match = await getMatchEvents(
    ddbClient,
    envvars.MATCH_EVENTS_TABLE,
    match_id
  );

  return {
    statusCode: enums.StatusCodes.success,
    body: JSON.stringify({
      status: enums.ResponseStatuses.success,
      match,
    }),
  };
}
