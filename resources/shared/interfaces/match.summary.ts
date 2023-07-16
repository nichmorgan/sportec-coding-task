export interface ITeamSummary {
  total_matches: number;
  total_wins: number;
  total_draws: number;
  total_losses: number;
  total_goals_scored: number;
  total_goals_conceded: number;
}

export interface IMatchSummary {
  date: string;
  team: string;
  opponent: string;
  total_goals: number;
  total_fouls: number;
}
