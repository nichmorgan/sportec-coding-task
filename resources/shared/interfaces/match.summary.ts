export interface TeamSummary {
  total_matches: number;
  total_wins: number;
  total_draws: number;
  total_losses: number;
  total_goals_scored: number;
  total_goals_conceded: number;
}

// TODO: add date field
export interface MatchSummary {
  team: string;
  opponent: string;
  total_goals: number;
  total_fouls: number;
}
