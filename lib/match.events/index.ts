import { Construct } from "constructs";
import { MatchEventsApi } from "./api";
import { Database } from "../common/database";
import { aws_dynamodb as dynamodb } from "aws-cdk-lib";

export class MatchEvents extends Construct {
  readonly database: Database;
  readonly api: MatchEventsApi;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.database = new Database(this, "database", {
      tableName: "match_events",
      stream: dynamodb.StreamViewType.NEW_IMAGE,
      pk: "event_id",
    });
    this.api = new MatchEventsApi(this, "api", {
      database: this.database,
    });
  }
}
