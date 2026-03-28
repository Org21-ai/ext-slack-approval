# slack-approval

custom action to send approval request to Slack


## trigger
<image src="img/approve_at_reply.png" width="300" height="300" />

- When action is triggered, Post or Update in Slack, a reply message appears simultaneously with "Approve" and "Reject" buttons
## approve
<image src="img/approved.png" width="300" height="300" />

- Clicking on "Approve" will execute next steps

## reject and cancel
<image src="img/rejected.png" width="300" height="300" />
<image src="img/canceled.png" width="300" height="50" />

- Clicking on "Reject" or "cancel workflow" will cause workflow to fail and update reply message





# How To Use

- First, create a Slack App and install in your workspace.
- Second. set the `App Manifest`
```json
{
    "display_information": {
        "name": "ApprveApp"
    },
    "features": {
        "bot_user": {
            "display_name": "ApproveApp",
            "always_online": false
        }
    },
    "oauth_config": {
        "scopes": {
            "bot": [
                "app_mentions:read",
                "channels:join",
                "chat:write",
                "users:read"
            ]
        }
    },
    "settings": {
        "interactivity": {
            "is_enabled": true
        },
        "org_deploy_enabled": false,
        "socket_mode_enabled": true,
        "token_rotation_enabled": false
    }
}
```

- set workflow step
```yaml
jobs:
  approval:
    runs-on: ubuntu-latest
    steps:
      - name: send approval
        uses: Org21-ai/ext-slack-approval@main
        env:
          SLACK_APP_TOKEN: ${{ secrets.SLACK_APP_TOKEN }}
          SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
          SLACK_SIGNING_SECRET: ${{ secrets.SLACK_SIGNING_SECRET }}
          SLACK_CHANNEL_ID: ${{ secrets.SLACK_CHANNEL_ID }}
        timeout-minutes: 120
        with:
            approvers: user1,user2
            minimumApprovalCount: 2
            mainChannel: true
            baseMessagePayload: |
              {}
            successMessagePayload: |
              {}
            failMessagePayload: |
              {}
```

## Set environment variables

  - `SLACK_APP_TOKEN`

    - App-level tokens on `Basic Information page`. (starting with `xapp-` )

  - `SLACK_BOT_TOKEN`

    - Bot-level tokens on `OAuth & Permissions page`. (starting with `xoxb-` )

  - `SLACK_SIGNING_SECRET`

    - Signing Secret on `Basic Information page`.

  - `SLACK_CHANNEL_ID`

    - Channel ID for which you want to send approval.

## Set Inputs

  - `baseMessageTs`
    - If provided, updates the target message. If not provided, creates a new message
    - Optional

  - `approvers`
    - A comma-separated list of approvers' slack user ids
    - Required

  - `minimumApprovalCount`
    - The minimum number of approvals required
    - Optional (default: "1")

  - `baseMessagePayload`
    - The base message payload to display. If not set, will use default message from README. To customize, provide Slack message payload JSON
    - Optional (default: "{}")

  - `successMessagePayload`
    - The message body indicating approval is success. If not set, will use baseMessagePayload.
    - Optional (default: "{}")

  - `failMessagePayload`
    - The message body indicating approval is fail. If not set, will use baseMessagePayload.
    - Optional (default: "{}")

  - `mainChannel`
    - If `true`, the approval message (with Approve/Reject buttons) is posted in the channel main timeline as a separate top-level message. If `false`, it is posted as a thread reply under the main message.
    - Optional (default: "false")

  - `includeCommitContext`
    - If `true` (default), appends commit/PR context to the main Slack message for both the built-in default and a custom `baseMessagePayload`. Set to `false` if your payload already includes commit info and you want to avoid duplication.
    - Optional (default: "true")

When `includeCommitContext` is enabled, commit context is merged in when available:
- `Commit` short SHA from `GITHUB_SHA`
- `Commit message` from the GitHub event payload (`push`: `head_commit.message`; `pull_request`: PR title and body)


## outputs

- `mainMessageTs`
  - Timestamp of the main message sent to Slack

- `replyMessageTs`
  - Timestamp of the reply message sent to Slack

- `commitShortSha`
  - Short SHA (7 characters) from `GITHUB_SHA`; matches the `*Commit*` field when `includeCommitContext` is enabled

- `commitContextMessage`
  - Truncated commit or PR summary; matches the `*Commit message*` field when `includeCommitContext` is enabled. These values are computed with the same logic as the Slack message, but like all step outputs they are only available to **later** steps after the approval step finishes (the step blocks until approve/reject/timeout). For an earlier CI notice, use `extract-commit-context` below.

## Aligning a CI Slack notice with the production approval message

If you post a **separate** Slack message when CI completes (before the approval step), use the companion composite action so the notice uses the **same** commit/PR text as the approval card:

```yaml
- uses: Org21-ai/ext-slack-approval/extract-commit-context@main
  id: ctx

- name: Post CI notice to Slack
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "CI finished for `${{ steps.ctx.outputs.commitShortSha }}`: ${{ steps.ctx.outputs.commitContextMessage }}"
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}

- uses: Org21-ai/ext-slack-approval@main
  id: approval
  # ... same workflow run; approval message will show matching Commit / Commit message when includeCommitContext is true
```

The script in `extract-commit-context` follows the same rules as `src/index.ts` (`head_commit.message`, then PR title/body, 300-character truncation). If you change one, update the other and keep them in sync.

## Manual testing (mainChannel)

To verify the `mainChannel` option:

1. Run the action twice in a channel (e.g. via `workflow_dispatch`), once with `mainChannel: false` (or omitted) and once with `mainChannel: true`.
2. **With `mainChannel: false` (default):** The approval message (approvers + Approve/Reject buttons) appears as a **thread reply** under the first message. You must open the thread to see the buttons.
3. **With `mainChannel: true`:** The approval message appears as a **second top-level message** in the channel; both messages are visible in the main feed without opening a thread.
4. Confirm Approve/Reject and cancel (timeout) still update the correct message in both runs.

