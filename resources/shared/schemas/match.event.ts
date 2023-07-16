import * as yup from "yup";
import { enums, interfaces } from "..";

const MIN_STRING_LEN = 1;

const isDateString: yup.TestConfig<string | undefined> = {
  exclusive: true,
  name: "isDateString",
  message: "${path} is not an valid date string",
  test: (value) => Boolean(Date.parse(value as string)),
};

export const commonString = yup.string().min(MIN_STRING_LEN);
export const url = yup.string().url();
export const minute = yup.number().integer().positive();
export const timestamp = yup.string().test(isDateString);

const matchEventGoalDetailsSchema = yup
  .object<interfaces.IMatchEventGoalDetails>({
    player: commonString.required(),
    video_url: url.required(),
    minute: minute.required(),
    goal_type: commonString.required(),
    assist: commonString,
  })
  .noUnknown();

const matchEventFoulDetailsSchema = yup
  .object<interfaces.IMatchEventFoulDetails>({
    player: commonString.required(),
    video_url: url.required(),
    minute: minute.required(),
  })
  .noUnknown();

export const matchEventSchema = yup
  .object<interfaces.IMatchEvent>({
    match_id: commonString.required(),
    timestamp: timestamp.required(),
    team: commonString.required(),
    opponent: commonString.required(),
    event_type: commonString.required(),
    event_details: yup
      .mixed()
      .default(null)
      .when("event_type", {
        is: enums.MatchEventType.foul,
        then: () => matchEventFoulDetailsSchema,
      })
      .when("event_type", {
        is: enums.MatchEventType.goal,
        then: () => matchEventGoalDetailsSchema,
      }),
  })
  .noUnknown();
