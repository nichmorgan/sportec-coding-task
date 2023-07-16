import { interfaces, enums, schemas } from "/opt/shared";
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { eventToAttributeMap } from "./mappers";
import { v4 as uuidv4 } from "uuid";
import {
  DynamoDBClient,
  PutItemCommand,
  PutItemCommandInput,
} from "@aws-sdk/client-dynamodb";

export const DYNAMODB_CLIENT = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;
const KEY_NAME = process.env.KEY_NAME;

export async function insertOne(
  tableName: string,
  keyName: string,
  event: interfaces.IMatchEvent
): Promise<string> {
  const input = eventToAttributeMap(event);

  console.log(JSON.stringify({ "Insert input": input }, undefined, 2));

  const keyValue = uuidv4();
  const key = { [keyName]: { S: keyValue } };

  const commandInput: PutItemCommandInput = {
    TableName: tableName,
    Item: { ...key, ...input },
  };

  const command = new PutItemCommand(commandInput);
  await DYNAMODB_CLIENT.send(command);
  return keyValue;
}

const getFailResponse = (error: unknown) => ({
  statusCode: enums.StatusCodes.badFormat,
  body: JSON.stringify({
    status: enums.ResponseStatuses.error,
    message: enums.ResponseMatchEventMessages.failToIngest,
    error,
  }),
});

export async function main(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  if (!TABLE_NAME) throw new Error("Envvar TABLE_NAME is required.");
  if (!KEY_NAME) throw new Error("Envvar KEY_NAME is required.");

  let matchEvent: interfaces.IMatchEvent;
  try {
    matchEvent = JSON.parse(event.body as string);
    console.log("Event", JSON.stringify(matchEvent, undefined, 2));
  } catch {
    return getFailResponse("JSON is bad formatted");
  }

  try {
    await schemas.matchEventSchema.validate(matchEvent, { abortEarly: false });
  } catch ({ errors }: any) {
    console.error(JSON.stringify(errors, undefined, 2));
    return getFailResponse(errors);
  }

  console.log("Event is valid");

  const event_id = await insertOne(TABLE_NAME, KEY_NAME, matchEvent);

  return {
    statusCode: enums.StatusCodes.success,
    body: JSON.stringify(
      {
        status: enums.ResponseStatuses.success,
        message: enums.ResponseMatchEventMessages.successToIngest,
        data: {
          event_id,
          timestamp: matchEvent.timestamp,
        },
      },
      undefined,
      2
    ),
  };
}
