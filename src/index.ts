import * as core from "@actions/core";
import { App, BlockAction, LogLevel } from "@slack/bolt";
import { WebClient } from "@slack/web-api";
import * as fs from "fs";

const token = process.env.SLACK_BOT_TOKEN || "";
const signingSecret = process.env.SLACK_SIGNING_SECRET || "";
const slackAppToken = process.env.SLACK_APP_TOKEN || "";
const channel_id = process.env.SLACK_CHANNEL_ID || "";
const baseMessageTs = core.getInput("baseMessageTs");
const requiredApprovers = core
  .getInput("approvers", { required: true, trimWhitespace: true })
  ?.split(",");
const minimumApprovalCount = Number(core.getInput("minimumApprovalCount")) || 1;
const baseMessagePayload = JSON.parse(
  core.getMultilineInput("baseMessagePayload").join("")
);
const approvers: string[] = [];

const successMessagePayload = JSON.parse(
  core.getMultilineInput("successMessagePayload").join("")
);
const failMessagePayload = JSON.parse(
  core.getMultilineInput("failMessagePayload").join("")
);
const mainChannel = core.getInput("mainChannel").toLowerCase() === "true";
const includeCommitContext =
  core.getInput("includeCommitContext").toLowerCase() !== "false";

const app = new App({
  token: token,
  signingSecret: signingSecret,
  appToken: slackAppToken,
  socketMode: true,
  port: 3000,
  logLevel: LogLevel.DEBUG,
});

if (minimumApprovalCount > requiredApprovers.length) {
  console.error(
    "Error: Insufficient approvers. Minimum required approvers not met."
  );
  process.exit(1);
}
function hasPayload(inputs: any) {
  return inputs.text?.length > 0 || inputs.blocks?.length > 0;
}

function ellipsize(text: string, max = 300) {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 3)}...`;
}

function extractCommitContext() {
  const sha = process.env.GITHUB_SHA || "";
  const shortSha = sha ? sha.slice(0, 7) : "";
  const eventPath = process.env.GITHUB_EVENT_PATH || "";
  const fallback = {
    shortSha,
    message: "",
  };
  if (!eventPath) {
    return fallback;
  }

  try {
    const raw = fs.readFileSync(eventPath, "utf8");
    const event = JSON.parse(raw);
    if (typeof event.head_commit?.message === "string") {
      return {
        shortSha,
        message: event.head_commit.message,
      };
    }
    if (typeof event.pull_request?.title === "string") {
      const prTitle = event.pull_request.title;
      const prBody =
        typeof event.pull_request.body === "string"
          ? event.pull_request.body
          : "";
      return {
        shortSha,
        message: prBody ? `${prTitle} - ${prBody}` : prTitle,
      };
    }
  } catch (_error) {
    return fallback;
  }
  return fallback;
}

function mergeCommitContextIntoPayload(
  payload: Record<string, unknown>,
  ctx: { shortSha: string; commitMessage: string },
  enabled: boolean
): Record<string, unknown> {
  if (!enabled) {
    return { ...payload };
  }
  if (!ctx.shortSha && !ctx.commitMessage) {
    return { ...payload };
  }

  const out: Record<string, unknown> = { ...payload };

  if (Array.isArray(out.blocks)) {
    const fields: { type: string; text: string }[] = [];
    if (ctx.shortSha) {
      fields.push({
        type: "mrkdwn",
        text: `*Commit:*\n${ctx.shortSha}`,
      });
    }
    if (ctx.commitMessage) {
      fields.push({
        type: "mrkdwn",
        text: `*Commit message:*\n${ctx.commitMessage}`,
      });
    }
    if (fields.length === 0) {
      return out;
    }
    out.blocks = [...(out.blocks as unknown[]), { type: "section", fields }];
    return out;
  }

  if (typeof out.text === "string") {
    let t = out.text;
    if (ctx.shortSha) {
      t += `\n*Commit:* ${ctx.shortSha}`;
    }
    if (ctx.commitMessage) {
      t += `\n*Commit message:* ${ctx.commitMessage}`;
    }
    out.text = t;
    return out;
  }

  return out;
}

async function run(): Promise<void> {
  try {
    const web = new WebClient(token);

    const github_server_url = process.env.GITHUB_SERVER_URL || "";
    const github_repos = process.env.GITHUB_REPOSITORY || "";
    const run_id = process.env.GITHUB_RUN_ID || "";
    const run_number = process.env.GITHUB_RUN_NUMBER || "";
    const run_attempt = process.env.GITHUB_RUN_ATTEMPT || "";
    const workflow = process.env.GITHUB_WORKFLOW || "";
    const aid = `${github_repos}-${workflow}-${run_id}-${run_number}-${run_attempt}`;
    const runnerOS = process.env.RUNNER_OS || "";
    const actor = process.env.GITHUB_ACTOR || "";
    const actionsUrl = `${github_server_url}/${github_repos}/actions/runs/${run_id}`;
    const { shortSha, message } = extractCommitContext();
    const commitMessage = message
      ? ellipsize(message.replace(/\s+/g, " ").trim())
      : "";
    const baseMainPayload: Record<string, unknown> = hasPayload(
      baseMessagePayload
    )
      ? (baseMessagePayload as Record<string, unknown>)
      : {
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "GitHub Actions Approval Request",
              },
            },
            {
              type: "section",
              fields: [
                {
                  type: "mrkdwn",
                  text: `*GitHub Actor:*\n${actor}`,
                },
                {
                  type: "mrkdwn",
                  text: `*Repos:*\n${github_server_url}/${github_repos}`,
                },
                {
                  type: "mrkdwn",
                  text: `*Actions URL:*\n${actionsUrl}`,
                },
                {
                  type: "mrkdwn",
                  text: `*GITHUB_RUN_ID:*\n${run_id}`,
                },
                {
                  type: "mrkdwn",
                  text: `*Workflow:*\n${workflow}`,
                },
                {
                  type: "mrkdwn",
                  text: `*RunnerOS:*\n${runnerOS}`,
                },
              ],
            },
          ],
        };
    const mainMessagePayload = mergeCommitContextIntoPayload(
      baseMainPayload,
      { shortSha, commitMessage },
      includeCommitContext
    );

    core.setOutput("commitShortSha", shortSha);
    core.setOutput("commitContextMessage", commitMessage);

    const renderReplyTitle = () => {
      return {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Required Approvers Count:* ${minimumApprovalCount}\n*Remaining Approvers:* ${requiredApprovers
            .map((v) => `<@${v}>`)
            .join(", ")}\n${
            approvers.length > 0
              ? `Approvers: ${approvers.map((v) => `<@${v}>`).join(", ")} `
              : ""
          }\n`,
        },
      };
    };

    const renderReplyBody = () => {
      if (minimumApprovalCount > approvers.length) {
        return {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                emoji: true,
                text: "approve",
              },
              style: "primary",
              value: aid,
              action_id: "slack-approval-approve",
            },
            {
              type: "button",
              text: {
                type: "plain_text",
                emoji: true,
                text: "reject",
              },
              style: "danger",
              value: aid,
              action_id: "slack-approval-reject",
            },
          ],
        };
      }
      return {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Approved :white_check_mark:`,
        },
      };
    };

    function approve(userId: string) {
      const idx = requiredApprovers.findIndex((user) => user === userId);
      if (idx === -1) {
        return "notApproval";
      }
      requiredApprovers.splice(idx, 1);
      approvers.push(userId);

      if (approvers.length < minimumApprovalCount) {
        return "remainApproval";
      }

      return "approved";
    }

    const slackMainArgs = {
      channel: channel_id,
      ...mainMessagePayload,
    } as Parameters<typeof web.chat.postMessage>[0];

    const mainMessage = baseMessageTs
      ? await web.chat.update({
          channel: channel_id,
          ts: baseMessageTs,
          ...mainMessagePayload,
        } as Parameters<typeof web.chat.update>[0])
      : await web.chat.postMessage(slackMainArgs);

    const replyMessagePayload: {
      channel: string;
      thread_ts?: string;
      text: string;
      blocks: unknown[];
    } = {
      channel: channel_id,
      text: "",
      blocks: [renderReplyTitle(), renderReplyBody()],
    };
    if (!mainChannel) {
      replyMessagePayload.thread_ts = mainMessage.ts;
    }
    const replyMessage = await web.chat.postMessage(replyMessagePayload);

    core.setOutput("mainMessageTs", mainMessage.ts);
    core.setOutput("replyMessageTs", replyMessage.ts);

    async function cancelHandler() {
      await web.chat.update({
        ts: mainMessage.ts!,
        channel: channel_id,
        ...(hasPayload(failMessagePayload)
          ? failMessagePayload
          : mainMessagePayload),
      });
      await web.chat.update({
        ts: replyMessage.ts!,
        text: "",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `Canceled :radio_button: :leftwards_arrow_with_hook:`,
            },
          },
        ],
        channel: channel_id,
      });
      process.exit(1);
    }

    process.on("SIGTERM", cancelHandler);
    process.on("SIGINT", cancelHandler);
    process.on("SIGBREAK", cancelHandler);

    app.action(
      "slack-approval-approve",
      async ({ ack, client, body, logger, action }) => {
        await ack();
        if (action.type !== "button") {
          return;
        }
        if (action.value !== aid) {
          return;
        }
        const approveResult = approve(body.user.id);

        try {
          if (approveResult === "approved") {
            await client.chat.update({
              ts: mainMessage.ts || "",
              channel: body.channel?.id || "",
              ...(hasPayload(successMessagePayload)
                ? successMessagePayload
                : mainMessagePayload),
            });
          }
          await client.chat.update({
            channel: body.channel?.id || "",
            ts: replyMessage?.ts || "",
            text: "",
            blocks: [renderReplyTitle(), renderReplyBody()],
          });
        } catch (error) {
          logger.error(error);
        }

        if (approveResult === "approved") {
          process.exit(0);
        }
      }
    );

    app.action(
      "slack-approval-reject",
      async ({ ack, client, body, logger, action }) => {
        await ack();
        if (action.type !== "button") {
          return;
        }
        if (action.value !== aid) {
          return;
        }
        try {
          const response_blocks = (<BlockAction>body).message?.blocks;
          response_blocks.pop();
          response_blocks.push({
            type: "section",
            text: {
              type: "mrkdwn",
              text: `Rejected by <@${body.user.id}> :x:`,
            },
          });

          await client.chat.update({
            ts: mainMessage.ts || "",
            channel: body.channel?.id || "",
            ...(hasPayload(failMessagePayload)
              ? failMessagePayload
              : mainMessagePayload),
          });

          await client.chat.update({
            channel: body.channel?.id || "",
            ts: replyMessage?.ts || "",
            text: "",
            blocks: response_blocks,
          });
        } catch (error) {
          logger.error(error);
        }

        process.exit(1);
      }
    );

    (async () => {
      await app.start(3000);
      console.log("Waiting Approval reaction.....");
    })();
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message);
  }
}

run();
