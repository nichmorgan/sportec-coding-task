import { DynamoAttributeValue } from "aws-cdk-lib/aws-stepfunctions-tasks";
import { SummaryDatabaseService } from "./database.service";
import { enums } from "/opt/shared";

interface SummaryServiceConfig {
  teamDatabaseService: SummaryDatabaseService;
  matchSummaryDatabaseService: SummaryDatabaseService;
  matchEventsDatabaseService: SummaryDatabaseService;
}

interface RegisterProps {
  match_id: string;
  team: string;
  opponent: string;
}

interface RegisterStartMatchProps extends RegisterProps {
  timestamp: string;
}

export class SummaryService {
  private readonly teamDatabaseService: SummaryDatabaseService;
  private readonly matchSummaryDatabaseService: SummaryDatabaseService;
  private readonly matchEventsDatabaseService: SummaryDatabaseService;

  constructor({
    teamDatabaseService,
    matchSummaryDatabaseService,
    matchEventsDatabaseService,
  }: SummaryServiceConfig) {
    this.matchSummaryDatabaseService = matchSummaryDatabaseService;
    this.teamDatabaseService = teamDatabaseService;
    this.matchEventsDatabaseService = matchEventsDatabaseService;
  }

  async registerGoal(input: RegisterProps) {
    return Promise.all([
      this.registerGoalInTeamSummaries(input),
      this.registerGoalInMatchSummaries(input),
    ]);
  }

  async registerFoul({ team, opponent, match_id }: RegisterProps) {
    return this.matchSummaryDatabaseService.updateOne({
      key: match_id,
      add: { total_fouls: DynamoAttributeValue.fromNumber(1) },
      setIfNotExist: {
        team: DynamoAttributeValue.fromString(team),
        opponent: DynamoAttributeValue.fromString(opponent),
        total_goals: DynamoAttributeValue.fromNumber(0),
      },
    });
  }

  async registerStartMatch(input: RegisterStartMatchProps) {
    return Promise.all([
      this.registerStartMatchInTeamSummary(input),
      this.registerStartMatchInMatchSummary(input),
    ]);
  }

  async registerEndMatch({ match_id }: Pick<RegisterProps, "match_id">) {
    const findResult = this.matchEventsDatabaseService.find({
      match_id: DynamoAttributeValue.fromString(match_id),
      event_type: DynamoAttributeValue.fromString(enums.MatchEventType.goal),
    });

    const matchSummary = await this.matchSummaryDatabaseService.findOneByKey(
      match_id
    );

    if (!matchSummary.Item)
      throw new Error(`Not found match with id ${match_id} in MatchSummary.`);

    let scores: Record<string, number> = {
      [matchSummary.Item.team.S as string]: 0,
      [matchSummary.Item.opponent.S as string]: 0,
    };
    const teamNames = Object.keys(scores);
    for await (const { team } of findResult) {
      const teamName = team.S as string;
      if (!teamNames.includes(teamName))
        throw new Error(
          `Different team names are not allowed: ${teamName} is not in ${teamNames}`
        );
      scores[team.S as string] += 1;
    }

    if (teamNames[0] === teamNames[1])
      return this.registertEndMatchDraw(teamNames);
    else if (teamNames[0] > teamNames[1])
      return this.registerEndMatchWinnerAndLoser({
        winner: teamNames[0],
        loser: teamNames[1],
      });
    else
      return this.registerEndMatchWinnerAndLoser({
        winner: teamNames[1],
        loser: teamNames[0],
      });
  }

  private async registerEndMatchWinnerAndLoser({
    winner,
    loser,
  }: {
    winner: string;
    loser: string;
  }) {
    const updateWinner = this.teamDatabaseService.updateOne({
      key: winner,
      add: { total_wins: DynamoAttributeValue.fromNumber(1) },
    });
    const updateLoser = this.teamDatabaseService.updateOne({
      key: loser,
      add: { total_losses: DynamoAttributeValue.fromNumber(1) },
    });

    return Promise.all([updateWinner, updateLoser]);
  }

  private async registertEndMatchDraw(teams: string[]) {
    return Promise.all(
      teams.map((t) =>
        this.teamDatabaseService.updateOne({
          key: t,
          add: { total_draws: DynamoAttributeValue.fromNumber(1) },
        })
      )
    );
  }

  private async registerStartMatchInTeamSummary({
    team,
    opponent,
  }: Pick<RegisterStartMatchProps, "team" | "opponent">) {
    const setIfNotExist = {
      total_wins: DynamoAttributeValue.fromNumber(0),
      total_draws: DynamoAttributeValue.fromNumber(0),
      total_losses: DynamoAttributeValue.fromNumber(0),
      total_goals_scored: DynamoAttributeValue.fromNumber(0),
      total_goals_conceded: DynamoAttributeValue.fromNumber(0),
    };
    const add = {
      total_matches: DynamoAttributeValue.fromNumber(1),
    };

    const teamPromise = this.teamDatabaseService.updateOne({
      key: team,
      setIfNotExist,
      add,
    });

    const opponentPromise = this.teamDatabaseService.updateOne({
      key: opponent,
      setIfNotExist,
      add,
    });

    return Promise.all([teamPromise, opponentPromise]);
  }

  private async registerStartMatchInMatchSummary({
    team,
    opponent,
    match_id,
    timestamp,
  }: RegisterStartMatchProps) {
    return this.matchSummaryDatabaseService.updateOne({
      key: match_id,
      setIfNotExist: {
        team: DynamoAttributeValue.fromString(team),
        opponent: DynamoAttributeValue.fromString(opponent),
        total_goals: DynamoAttributeValue.fromNumber(0),
        total_fouls: DynamoAttributeValue.fromNumber(0),
      },
      set: {
        date: DynamoAttributeValue.fromString(timestamp),
      },
    });
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
    return this.matchSummaryDatabaseService.updateOne({
      key: match_id,
      add: { total_goals: DynamoAttributeValue.fromNumber(1) },
      setIfNotExist: {
        team: DynamoAttributeValue.fromString(team),
        opponent: DynamoAttributeValue.fromString(opponent),
        total_fouls: DynamoAttributeValue.fromNumber(0),
      },
    });
  }
}
