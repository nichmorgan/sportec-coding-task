import { Construct } from "constructs";
import { Database } from "../common/database";
import { MatchEventStreamProcessor } from "./match.event.stream";
import { MatchSummaryApi as SummaryApi } from "./api";

export interface MatchSummaryProps {
  matchEventsDatabase: Database;
}

export class Summary extends Construct {
  constructor(scope: Construct, id: string, props: MatchSummaryProps) {
    super(scope, id);

    const { matchEventsDatabase } = props;

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
      matchEventsDatabase,
    });

    new SummaryApi(this, "summaryApi", {
      matchEventsDatabase,
      matchSummaryDatabase,
      teamSummaryDatabase,
    });
  }
}
