import { enums, interfaces } from "/opt/shared";

export interface ResponseMatch
  extends Pick<interfaces.IMatchSummary, "team" | "opponent" | "date"> {
  match_id: string;
}

export interface PaginatedResponse {
  status: enums.ResponseStatuses.success;
  matches: ResponseMatch[];
}
