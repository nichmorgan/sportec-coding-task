import { enums } from "/opt/shared";

export interface ResponseMatch {
  match_id: string;
  team: string;
  opponent: string;
  // date: string;
}

export interface PaginatedResponse {
  status: enums.ResponseStatuses.success;
  matches: ResponseMatch[];
}
