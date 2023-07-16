export interface IMatchEventGoalDetails {
  player: string;
  goal_type: string;
  minute: number;
  assist: string | null;
  video_url: string;
}

export type IMatchEventFoulDetails = Omit<
  IMatchEventGoalDetails,
  "assist" | "goal_type"
>;

export type IMatchEventStartMatchDetails = null;
export type IMatchEventEndMatchDetails = null;

export type IMatchEventDetails =
  | IMatchEventGoalDetails
  | IMatchEventFoulDetails
  | IMatchEventStartMatchDetails
  | IMatchEventEndMatchDetails;

export interface IMatchEvent {
  match_id: string;
  timestamp: string;
  team: string;
  opponent: string;
  event_type: string;
  event_details: IMatchEventDetails;
}
