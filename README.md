# Welcome to Sportec Ingestion Application

## **Useful commands**

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template

## **Overview**

The application processes football data, currently with guaranteed support for the following events:

* `goal`: records a goal, with the scoring team being the one present in the 'team' field.
* `foul`: records a foul, with the team committing the foul indicated in the 'team' field.
* `startMatch`: records the start of the match, performing an initial load into the tables with zeroed metrics if they don't exist for the teams and the match.
* `endMatch`: records the end of the match, calculating at this moment which team was the winner based on the goal count.


### **Infra and data flow**

The application follows the following flow:

1. Data ingestion API: entry point for match events.
2. API <-> Lambda Integration: processes, transforms, and stores the data in the events table.
3. DynamodbStream (Events): whenever something is inserted/updated in the events table, a message is triggered in the table's data stream.
4. Stream <-> Lambda: processes, transforms, and stores the data from the data stream into two separate statistics tables, one for teams and one for matches. The filter for this integration is: event_name === "INSERT" and dynamodb.NewImage.event_type in [goal, foul, startMatch, endMatch]
5. Data output API: matches, their events, and statistics related to teams and matches are accessible through this API.


## **How to deploy**

### System Requirements

* [Docker](https://docs.docker.com/engine/install/)
* [Nodejs LTS](https://nodejs.org/en)
* [Conta AWS](https://aws.amazon.com/)
* [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)

### Setup :hammer:

1. Install project dependencies

    ```bash
    npm install
    ```

2. Create access credentials: [wiki](https://docs.aws.amazon.com/powershell/latest/userguide/pstools-appendix-sign-up.html)

3. Configure and authorize cli aws

    ```bash
    aws configure
    ```

4. Bootstrap your aws account (if you haven't already done it)

    ```bash
    cdk bootstrap
    ```

### Deploy :rocket:

```bash
cdk deploy --require-approval never
```

If everything went well, the application is now available.

**The API url is shown in the terminal at the end of the deploy.**

### Cleaning :bomb:

```bash
cdk destroy
```

---

## **API**

Note: Always **content-type json/application**

### Event ingestion (POST /ingest)

This endpoint performs validations and data transformations during its use, this may vary according to the type of event being sent.

NOTE:
Currently, if a payload with an event_type other than those below is sent, it will be inserted into the database without validation, but it will not trigger any statistical trigger.

EVENTS:

<details>
<summary>Goal Event</summary>

* Model

```js
    {
        match_id: string,
        timestamp: string,
        team: string,
        opponent: string,
        event_type: "foul",
        event_details: {
            player: string,
            minute: number,
            video_url: string
        }
    }
```

* **Validations**
  * All fields are required
  * Extra fields are forbiden
  * event_details:
    * minute must be int and positive
    * video_url must be an url

* Example

```json
{
    "match_id": "12345",
    "timestamp": "2023-06-22T19:45:30Z",
    "team": "FC Barcelona",
    "opponent": "Real Madrid",
    "event_type": "foul",
    "event_details": {
        "player": "Lionel Messi",
        "minute": 30,
        "video_url": "https://example.com/goal_video.mp4"
    }
}
```

</details>

<details>
<summary>Foul Event</summary>

* Model

```js
    {
        match_id: string,
        timestamp: string,
        team: string,
        opponent: string,
        event_type: "foul",
        event_details: {
            player: string,
            minute: number,
            video_url: string
        }
    }
```

* **Validations**
  * All fields are required
  * Extra fields are forbiden
  * event_details:
    * minute must be int and positive
    * video_url must be an url

* Example

```json
{
    "match_id": "12345",
    "timestamp": "2023-06-22T19:45:30Z",
    "team": "FC Barcelona",
    "opponent": "Real Madrid",
    "event_type": "foul",
    "event_details": {
        "player": "Lionel Messi",
        "minute": 30,
        "video_url": "https://example.com/goal_video.mp4"
    }
}
```

</details>

<details>
<summary>startMatch or endMatch events</summary>

* Model

```js
    {
        match_id: string,
        timestamp: string,
        team: string,
        opponent: string,
        event_type: "startMatch" | "endMatch",
        event_details: null
    }
```

* **Validations**
  * All fields are required
  * Extra fields are forbiden
  * event_details are override to null always

* Example

```json
{
    "match_id": "12345",
    "timestamp": "2023-06-22T19:45:30Z",
    "team": "FC Barcelona",
    "opponent": "Real Madrid",
    "event_type": "startMatch",
    "event_details": null
}
```

</details>

### Get data and statistics

<details>
<summary>GET /matches : Retrieve a list of all matches.</summary>

* Model

```js
    {
        status: "success",
        matches: [
            {
                match_id: string,
                team: string,
                opponent: string,
                date: string
            }
        ]
    }
```

* Example

```json
    {
        "status": "success",
        "matches": [
            {
                "match_id": "12345",
                "team": "FC Barcelona",
                "opponent": "Real Madrid",
                "date": "2023-06-22T19:00:00Z"
            }
        ]
    }
```

</details>

<details>
<summary>GET /matches/{match_id} : Retrieve details of a specific match.</summary>

* Model

```js
{
    status: "success",
    match: {
        match_id: string,
        team: string,
        opponent: string,
        date: string,
        events: any[]
    }
}
```

* Example

```json
{
    "status": "success",
    "match": {
        "match_id": "12345",
        "team": "FC Barcelona",
        "opponent": "Real Madrid",
        "date": "2023-06-22T19:00:00Z",
        "events": [
            {
                "event_type": "endMatch",
                "timestamp": "2023-06-22T19:50:00Z",
            },
            {
                "event_type": "goal",
                "timestamp": "2023-06-22T19:45:30Z",
                "player": "Lionel Messi",
                "goal_type": "penalty",
                "minute": 30,
                "video_url": "https://example.com/goal_video.mp4"
            },
            {
                "event_type": "foul",
                "timestamp": "2023-06-22T19:42:00Z",
                "player": "Sergio Ramos",
                "minute": 32
            },
            {
                "event_type": "startMatch",
                "timestamp": "2023-06-22T18:00:00Z",
            }
        ]
    }
}
```

</details>

<details>
<summary>GET /matches/{match_id}/statistics: Retrieve statistics for a specific match.</summary>

* Model

```js
{
    status: "success",
    match_id: string,
    statistics: {
        team: string,
        opponent: string,
        total_goals: number,
        total_fouls: number,
    }
}
```

* Example

```json
{
    "status": "success",
    "match_id": "12345",
    "statistics": {
        "team": "FC Barcelona",
        "opponent": "Real Madrid",
        "total_goals": 3,
        "total_fouls": 2,
    }
}
```

</details>

<details>
<summary> GET /teams/{team_name}/statistics : Retrieve statistics for a specific team across all matches.</summary>

* Model

```js
{
    status: "success",
    team: string,
    statistics: {
        total_matches: number,
        total_wins: number,
        total_draws: number,
        total_losses: number,
        total_goals_scored: number,
        total_goals_conceded: number,
    }
}
```

* Example

```json
{
    "status": "success",
    "team": "FC Barcelona",
    "statistics": {
        "total_matches": 38,
        "total_wins": 28,
        "total_draws": 6,
        "total_losses": 4,
        "total_goals_scored": 89,
        "total_goals_conceded": 36
    }
}
```

</details>

---

## Design decisions

* Field removal *ball_possession_percentage*:  

The field was removed due to the non-existence of any event that indicates the resumption of the ball in order to calculate the time of possession.

* Statistics by Stream data:

The statistical tables are fed through the stream of insertion in dynamodb, so the data brought are persistent in the database, in order to reduce calls to the event table.

## Improvement points

### Data ingestion validation

* Ensure each match_id only represents 2 teams
* Create more comprehensive validations for the timestamp

### Stream Processing

* Implement batchprocess to avoid batch loss due to an error in an item.
* Fanout of bad posts

### Data display

* Match listing pagination needs to be improved.

### CI/CD and testing

* CI/CD is not currently developed for automatic testing and deployment.
