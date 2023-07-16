import {
  DynamoDBClient,
  UpdateItemCommandInput,
  UpdateItemCommand,
  AttributeValue,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoAttributeValue,
  DynamoReturnValues,
} from "aws-cdk-lib/aws-stepfunctions-tasks";

interface UpdateInput {
  key: string;
  setIfNotExist?: Record<string, DynamoAttributeValue>;
  add: Record<string, DynamoAttributeValue>;
}

type PreparationInput = Pick<
  UpdateItemCommandInput,
  "UpdateExpression" | "ExpressionAttributeNames" | "ExpressionAttributeValues"
>;

type OperationType = "SET" | "ADD";

interface SummaryDatabaseServiceProps {
  tableName: string;
  keyName: string;
}

export class SummaryDatabaseService {
  private readonly client: DynamoDBClient;
  private readonly tableName: string;
  private readonly keyName: string;

  constructor(
    client: DynamoDBClient,
    { tableName, keyName }: SummaryDatabaseServiceProps
  ) {
    this.client = client;
    this.tableName = tableName;
    this.keyName = keyName;
  }

  private prepareOperation(
    operation: OperationType,
    input: Record<string, DynamoAttributeValue>
  ): PreparationInput {
    const names = {};
    const values = {};
    let expression = `${operation} `;

    Object.keys(input).forEach((key, index, arr) => {
      const keyName = `#${key}`;
      const keyValue = `:${key}`;

      Object.assign(names, { [keyName]: key });
      Object.assign(values, {
        [keyValue]: input[key].attributeValue,
      });

      switch (operation) {
        case "SET":
          expression += `${keyName} = if_not_exists(${keyName}, ${keyValue})`;
          break;
        default:
          expression += `${keyName} ${keyValue}`;
      }

      if (index < arr.length - 1) expression += ", ";
    });

    return {
      UpdateExpression: expression,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    };
  }

  async updateOne({
    setIfNotExist: set,
    add,
    key,
  }: UpdateInput): Promise<Record<string, AttributeValue> | undefined> {
    const setOperation = set ? this.prepareOperation("SET", set) : null;
    const addOperation = this.prepareOperation("ADD", add);

    console.log({ setOperation, addOperation });

    const preparationParams: PreparationInput = {
      UpdateExpression: `${addOperation.UpdateExpression} ${setOperation?.UpdateExpression}`,
      ExpressionAttributeNames: {
        ...addOperation.ExpressionAttributeNames,
        ...setOperation?.ExpressionAttributeNames,
      },
      ExpressionAttributeValues: {
        ...addOperation.ExpressionAttributeValues,
        ...setOperation?.ExpressionAttributeValues,
      },
    };

    const commandInput: UpdateItemCommandInput = {
      TableName: this.tableName,
      Key: {
        [this.keyName]: DynamoAttributeValue.fromString(key).attributeValue,
      },
      ReturnValues: DynamoReturnValues.UPDATED_NEW,
      ...preparationParams,
    };
    console.log(commandInput);

    const command = new UpdateItemCommand(commandInput);
    const result = await this.client.send(command);

    console.log(result);
    return result.Attributes;
  }
}
