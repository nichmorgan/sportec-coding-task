import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import { aws_dynamodb as dynamodb } from "aws-cdk-lib";

export interface DatabaseProps {
  tableName: string;
  pk?: string;
  stream?: dynamodb.StreamViewType;
}

export class Database extends Construct {
  readonly table: dynamodb.Table;
  readonly pk: string;

  constructor(scope: Construct, id: string, props: DatabaseProps) {
    super(scope, id);

    const { tableName, pk, stream } = props;

    this.pk = pk ?? `${tableName}_id`;

    this.table = new dynamodb.Table(this, tableName, {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: this.pk,
        type: dynamodb.AttributeType.STRING,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: tableName,
      stream,
    });
  }
}
