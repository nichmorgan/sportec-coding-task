import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import {
  DynamoDBClient,
  DynamoDBPaginationConfiguration,
  paginateScan,
  ScanCommandInput,
} from "@aws-sdk/client-dynamodb";
import { yup, schemas, enums } from "/opt/shared";
import { PaginatedResponse, ResponseMatch } from "./interfaces";

const SettingsSchema = yup.object({
  MATCH_SUMMARY_TABLE: schemas.commonString.required(
    "MATCH_SUMMARY_TABLE envvar is required"
  ),
});

async function getMatchList(
  client: DynamoDBClient,
  tableName: string,
  pagination: Required<
    Pick<DynamoDBPaginationConfiguration, "pageSize" | "startingToken">
  >
): Promise<PaginatedResponse> {
  const input: ScanCommandInput = {
    TableName: tableName,
    Limit: pagination.pageSize * (pagination.startingToken + 1),
  };

  const matches: ResponseMatch[] = [];

  // Pagination scan has bugs... 🐛
  for await (const page of paginateScan({ client, ...pagination }, input)) {
    if (!page.Items) break;

    page.Items.forEach((item) => {
      matches.push({
        match_id: item.match_id.S as string,
        team: item.team.S as string,
        opponent: item.opponent.S as string,
        date: item.date.S as string,
      });
    });
  }

  return {
    status: enums.ResponseStatuses.success,
    matches,
  };
}

export async function main(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const envvars: Record<string, string> = {
    MATCH_SUMMARY_TABLE: process.env.MATCH_SUMMARY_TABLE as string,
  };
  await SettingsSchema.validate(envvars);

  const limitQueryParam = event.queryStringParameters?.limit;
  const pageQueryParam = event.queryStringParameters?.page;

  const pageSize = limitQueryParam ? parseInt(limitQueryParam as string) : 10;
  const startingToken = pageQueryParam ? parseInt(pageQueryParam as string) : 0;
  await schemas.positiveInt.required().validate(pageSize);
  await yup.number().min(0).required().validate(startingToken);

  const ddbClient = new DynamoDBClient({});
  try {
    const response = await getMatchList(
      ddbClient,
      envvars.MATCH_SUMMARY_TABLE,
      {
        pageSize,
        startingToken,
      }
    );
    return {
      statusCode: enums.StatusCodes.success,
      body: JSON.stringify(response),
    };
  } catch (error) {
    return {
      statusCode: enums.StatusCodes.badFormat,
      body: JSON.stringify({
        status: enums.ResponseStatuses.error,
        message: enums.ResponseMatchEventMessages.failToGet,
        error,
      }),
    };
  }
}
