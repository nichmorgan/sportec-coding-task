import {
  DynamoDBClient,
  UpdateItemCommandInput,
  UpdateItemCommand,
  AttributeValue,
  ScanCommandInput,
  GetItemCommand,
  GetItemCommandInput,
  paginateScan,
} from "@aws-sdk/client-dynamodb";

interface UpdateInput {
  key: string;
  setIfNotExist?: Record<string, AttributeValue>;
  set?: Record<string, AttributeValue>;
  add?: Record<string, AttributeValue>;
}

type UpdatePreparationInput = Pick<
  UpdateItemCommandInput,
  "UpdateExpression" | "ExpressionAttributeNames" | "ExpressionAttributeValues"
>;

type FindPreparationInput = Pick<
  ScanCommandInput,
  "FilterExpression" | "ExpressionAttributeNames" | "ExpressionAttributeValues"
>;

type OperationType = "SET" | "SET_IF_NOT_EXISTS" | "ADD";

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

  private prepareUpdateOperation(
    operation: OperationType,
    input: Record<string, AttributeValue>
  ): UpdatePreparationInput {
    const attrNames = {};
    const attrValues = {};
    let expression = `${
      operation === "SET_IF_NOT_EXISTS" ? "SET" : operation
    } `;

    Object.keys(input).forEach((key, index, arr) => {
      const keyName = `#${key}`;
      const keyValue = `:${key}`;

      Object.assign(attrNames, { [keyName]: key });
      Object.assign(attrValues, {
        [keyValue]: input[key],
      });

      switch (operation) {
        case "SET_IF_NOT_EXISTS":
          expression += `${keyName} = if_not_exists(${keyName}, ${keyValue})`;
          break;
        case "SET":
          expression += `${keyName} = ${keyValue}`;
          break;
        default:
          expression += `${keyName} ${keyValue}`;
      }

      if (index < arr.length - 1) expression += ", ";
    });

    return {
      UpdateExpression: expression,
      ExpressionAttributeNames: attrNames,
      ExpressionAttributeValues: attrValues,
    };
  }

  async updateOne({
    set,
    setIfNotExist,
    add,
    key,
  }: UpdateInput): Promise<Record<string, AttributeValue> | undefined> {
    const setIfNotExistOperation = setIfNotExist
      ? this.prepareUpdateOperation("SET_IF_NOT_EXISTS", setIfNotExist)
      : null;
    const setOperation = set ? this.prepareUpdateOperation("SET", set) : null;
    const addOperation = add ? this.prepareUpdateOperation("ADD", add) : null;

    console.log(
      "Operators",
      setOperation,
      setIfNotExistOperation,
      addOperation
    );

    let setExpression = setIfNotExistOperation?.UpdateExpression ?? "";
    if (setOperation?.UpdateExpression) {
      let temporaryExpression = setOperation.UpdateExpression;
      if (setExpression.length) {
        setExpression += ", ";
        // Remove SET operator
        temporaryExpression = temporaryExpression.slice(3);
      }
      setExpression += temporaryExpression;
    }

    const addExpression = addOperation?.UpdateExpression ?? "";

    const preparationParams: UpdatePreparationInput = {
      UpdateExpression: `${addExpression} ${setExpression}`,
      ExpressionAttributeNames: {
        ...addOperation?.ExpressionAttributeNames,
        ...setIfNotExistOperation?.ExpressionAttributeNames,
        ...setOperation?.ExpressionAttributeNames,
      },
      ExpressionAttributeValues: {
        ...addOperation?.ExpressionAttributeValues,
        ...setIfNotExistOperation?.ExpressionAttributeValues,
        ...setOperation?.ExpressionAttributeValues,
      },
    };

    const commandInput: UpdateItemCommandInput = {
      TableName: this.tableName,
      Key: {
        [this.keyName]: { S: key },
      },
      ReturnValues: "ALL_NEW",
      ...preparationParams,
    };
    console.log("commandInput", commandInput);

    const command = new UpdateItemCommand(commandInput);
    const result = await this.client.send(command);

    console.log(result);
    return result.Attributes;
  }

  private prepareFindOperation(
    filter: Record<string, AttributeValue>
  ): FindPreparationInput {
    const attrNames = {};
    const attrValues = {};
    let expression = "";

    Object.keys(filter).forEach((key, index, arr) => {
      const keyName = `#${key}`;
      const keyValue = `:${key}`;

      Object.assign(attrNames, { [keyName]: key });
      Object.assign(attrValues, {
        [keyValue]: filter[key],
      });

      expression += `${keyName} = ${keyValue}`;

      if (index < arr.length - 1) expression += " AND ";
    });

    return {
      FilterExpression: expression,
      ExpressionAttributeNames: attrNames,
      ExpressionAttributeValues: attrValues,
    };
  }

  async findOneByKey(key: string) {
    const input: GetItemCommandInput = {
      TableName: this.tableName,
      Key: {
        [this.keyName]: { S: key },
      },
    };

    const command = new GetItemCommand(input);
    return this.client.send(command);
  }

  async *find(filter: Record<string, AttributeValue>) {
    const input: ScanCommandInput = {
      TableName: this.tableName,
      ...this.prepareFindOperation(filter),
    };

    let lastEvaluatedKey = undefined;
    do {
      const pagination = paginateScan({ client: this.client }, input);
      for await (const page of pagination) {
        lastEvaluatedKey = page.LastEvaluatedKey;
        for (const item of page.Items ?? []) {
          yield item;
        }
      }
    } while (typeof lastEvaluatedKey !== "undefined");
  }
}
