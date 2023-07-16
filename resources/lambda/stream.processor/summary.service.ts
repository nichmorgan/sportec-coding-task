import { SummaryDatabaseService } from "./database.service";
import { enums } from "/opt/shared";
import { AttributeValue } from "@aws-sdk/client-dynamodb";

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
      add: { total_fouls: { N: "1" } },
      setIfNotExist: {
        team: { S: team },
        opponent: { S: opponent },
        total_goals: { N: "0" },
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
      match_id: { S: match_id },
      event_type: { S: enums.MatchEventType.goal },
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

    console.log("match score", scores, teamNames);

    if (scores[teamNames[0]] === scores[teamNames[1]])
      return this.registertEndMatchDraw(teamNames);
    else if (scores[teamNames[0]] > scores[teamNames[1]])
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
      add: { total_wins: { N: "1" } },
    });
    const updateLoser = this.teamDatabaseService.updateOne({
      key: loser,
      add: { total_losses: { N: "1" } },
    });

    return Promise.all([updateWinner, updateLoser]);
  }

  private async registertEndMatchDraw(teams: string[]) {
    return Promise.all(
      teams.map((t) =>
        this.teamDatabaseService.updateOne({
          key: t,
          add: { total_draws: { N: "1" } },
        })
      )
    );
  }

  private async registerStartMatchInTeamSummary({
    team,
    opponent,
  }: Pick<RegisterStartMatchProps, "team" | "opponent">) {
    const setIfNotExist = {
      total_wins: { N: "0" },
      total_draws: { N: "0" },
      total_losses: { N: "0" },
      total_goals_scored: { N: "0" },
      total_goals_conceded: { N: "0" },
    };
    const add = {
      total_matches: { N: "1" },
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
        team: { S: team },
        opponent: { S: opponent },
        total_goals: { N: "0" },
        total_fouls: { N: "0" },
      },
      set: {
        date: { S: timestamp },
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
        total_goals_scored: { N: "1" },
      },
      setIfNotExist: {
        total_matches: { N: "0" },
        total_wins: { N: "0" },
        total_draws: { N: "0" },
        total_losses: { N: "0" },
        total_goals_conceded: { N: "0" },
      },
    });
    const concededGoalAddPromise = this.teamDatabaseService.updateOne({
      key: opponent,
      add: {
        total_goals_conceded: { N: "1" },
      },
      setIfNotExist: {
        total_matches: { N: "0" },
        total_wins: { N: "0" },
        total_draws: { N: "0" },
        total_losses: { N: "0" },
        total_goals_scored: { N: "0" },
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
      add: { total_goals: { N: "1" } },
      setIfNotExist: {
        team: { S: team },
        opponent: { S: opponent },
        total_fouls: { N: "0" },
      },
    });
  }
}
