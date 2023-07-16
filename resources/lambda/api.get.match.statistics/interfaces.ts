import { enums, interfaces } from "/opt/shared";

export interface ResponseMatchSummary {
  status: enums.ResponseStatuses.success;
  match_id: string;
  statistics: interfaces.IMatchSummary | null;
}
