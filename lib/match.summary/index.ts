import { Construct } from "constructs";
import { Database } from "../common/database";
import { MatchEventStreamProcessor } from "./match.event.stream";

export interface MatchSummaryProps {
  matchEventDatabase: Database;
}

export class MatchSummary extends Construct {
  constructor(scope: Construct, id: string, props: MatchSummaryProps) {
    super(scope, id);

    const matchSummaryDatabase = new Database(this, "matchSummaryDatabase", {
      tableName: "match_summary",
      pk: "match_id",
    });

    const teamSummaryDatabase = new Database(this, "teamSummaryDatabase", {
      tableName: "team_summary",
      pk: "team",
    });

    new MatchEventStreamProcessor(this, "streamProcessor", {
      matchSummaryDatabase,
      teamSummaryDatabase,
      streamDatabase: props.matchEventDatabase,
    });
  }
}
