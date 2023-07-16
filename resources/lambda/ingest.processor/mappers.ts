import { AttributeValue } from "@aws-sdk/client-dynamodb";
import { enums, interfaces } from "/opt/shared";

const mapGoalEventDetail = (
  details: interfaces.IMatchEventGoalDetails
): AttributeValue => ({
  M: {
    player: { S: details.player },
    assist: details.assist ? { S: details.assist } : { NULL: true },
    goal_type: { S: details.goal_type },
    minute: { N: details.minute.toString() },
    video_url: { S: details.video_url },
  },
});

const mapFoulEventDetail = (
  details: interfaces.IMatchEventFoulDetails
): AttributeValue => ({
  M: {
    player: { S: details.player },
    minute: { N: details.minute.toString() },
    video_url: { S: details.video_url },
  },
});

export function eventToAttributeMap(event: interfaces.IMatchEvent) {
  const input: Record<string, AttributeValue> = {
    match_id: { S: event.match_id },
    timestamp: { S: event.timestamp },
    team: { S: event.team },
    opponent: { S: event.opponent },
    event_type: { S: event.event_type },
  };

  switch (event.event_type) {
    case enums.MatchEventType.goal:
      input.event_details = mapGoalEventDetail(
        event.event_details as interfaces.IMatchEventGoalDetails
      );
      break;
    case enums.MatchEventType.foul:
      input.event_details = mapFoulEventDetail(
        event.event_details as interfaces.IMatchEventFoulDetails
      );
      break;
    default:
      input.event_details = { NULL: true };
  }

  return input;
}
