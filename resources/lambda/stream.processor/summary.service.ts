import { DynamoAttributeValue } from "aws-cdk-lib/aws-stepfunctions-tasks";
import { SummaryDatabaseService } from "./database.service";

interface SummaryServiceConfig {
  teamDatabaseService: SummaryDatabaseService;
  matchDatabaseService: SummaryDatabaseService;
}

interface RegisterProps {
  match_id: string;
  team: string;
  opponent: string;
}

export class SummaryService {
  private readonly teamDatabaseService: SummaryDatabaseService;
  private readonly matchDatabaseService: SummaryDatabaseService;

  constructor({
    teamDatabaseService,
    matchDatabaseService,
  }: SummaryServiceConfig) {
    this.matchDatabaseService = matchDatabaseService;
    this.teamDatabaseService = teamDatabaseService;
  }

  private async registerGoalInTeamSummaries({
    team,
    opponent,
  }: Omit<RegisterProps, "match_id">) {
    const scoredGoalAddPromise = this.teamDatabaseService.updateOne({
      key: team,
      add: {
        total_goals_scored: DynamoAttributeValue.fromNumber(1),
      },
      setIfNotExist: {
        total_matches: DynamoAttributeValue.fromNumber(0),
        total_wins: DynamoAttributeValue.fromNumber(0),
        total_draws: DynamoAttributeValue.fromNumber(0),
        total_losses: DynamoAttributeValue.fromNumber(0),
        total_goals_conceded: DynamoAttributeValue.fromNumber(0),
      },
    });
    const concededGoalAddPromise = this.teamDatabaseService.updateOne({
      key: opponent,
      add: {
        total_goals_conceded: DynamoAttributeValue.fromNumber(1),
      },
      setIfNotExist: {
        total_matches: DynamoAttributeValue.fromNumber(0),
        total_wins: DynamoAttributeValue.fromNumber(0),
        total_draws: DynamoAttributeValue.fromNumber(0),
        total_losses: DynamoAttributeValue.fromNumber(0),
        total_goals_scored: DynamoAttributeValue.fromNumber(0),
      },
    });

    return Promise.all([scoredGoalAddPromise, concededGoalAddPromise]);
  }

  private async registerGoalInMatchSummaries({
    match_id,
    team,
    opponent,
  }: RegisterProps) {
    return this.matchDatabaseService.updateOne({
      key: match_id,
      add: { total_goals: DynamoAttributeValue.fromNumber(1) },
      setIfNotExist: {
        team: DynamoAttributeValue.fromString(team),
        opponent: DynamoAttributeValue.fromString(opponent),
        total_fouls: DynamoAttributeValue.fromNumber(0),
      },
    });
  }

  async registerGoal({ team, opponent, match_id }: RegisterProps) {
    await Promise.all([
      this.registerGoalInTeamSummaries({ team, opponent }),
      this.registerGoalInMatchSummaries({ match_id, team, opponent }),
    ]);
  }
}
