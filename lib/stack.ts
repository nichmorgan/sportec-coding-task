import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { MatchEvents } from "./match.events";
import { MatchSummary } from "./match.summary";

export class Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const matchEvent = new MatchEvents(this, "MatchEvents");

    new MatchSummary(this, "MatchSummary", {
      matchEventDatabase: matchEvent.database,
    });
  }
}
