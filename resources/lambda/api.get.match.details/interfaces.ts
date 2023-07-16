import { enums, interfaces } from "/opt/shared";

export interface ISuccessResponseMatch
  extends Pick<interfaces.IMatchEvent, "match_id" | "opponent" | "team"> {
  events: interfaces.IMatchEventDetails[];
  date: string;
}

export interface ISuccessResponse {
  status: enums.ResponseStatuses.success;
  match: ISuccessResponseMatch | null;
}
