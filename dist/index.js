"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const bolt_1 = require("@slack/bolt");
const web_api_1 = require("@slack/web-api");
const token = process.env.SLACK_BOT_TOKEN || "";
const signingSecret = process.env.SLACK_SIGNING_SECRET || "";
const slackAppToken = process.env.SLACK_APP_TOKEN || "";
const channel_id = process.env.SLACK_CHANNEL_ID || "";
const baseMessageTs = core.getInput("baseMessageTs");
const requiredApprovers = (_a = core
    .getInput("approvers", { required: true, trimWhitespace: true })) === null || _a === void 0 ? void 0 : _a.split(",");
const minimumApprovalCount = Number(core.getInput("minimumApprovalCount")) || 1;
const baseMessagePayload = JSON.parse(core.getMultilineInput("baseMessagePayload").join(""));
const approvers = [];
const successMessagePayload = JSON.parse(core.getMultilineInput("successMessagePayload").join(""));
const failMessagePayload = JSON.parse(core.getMultilineInput("failMessagePayload").join(""));
const mainChannel = core.getInput("mainChannel").toLowerCase() === "true";
const app = new bolt_1.App({
    token: token,
    signingSecret: signingSecret,
    appToken: slackAppToken,
    socketMode: true,
    port: 3000,
    logLevel: bolt_1.LogLevel.DEBUG,
});
if (minimumApprovalCount > requiredApprovers.length) {
    console.error("Error: Insufficient approvers. Minimum required approvers not met.");
    process.exit(1);
}
function hasPayload(inputs) {
    var _a, _b;
    return ((_a = inputs.text) === null || _a === void 0 ? void 0 : _a.length) > 0 || ((_b = inputs.blocks) === null || _b === void 0 ? void 0 : _b.length) > 0;
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const web = new web_api_1.WebClient(token);
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
            const mainMessagePayload = hasPayload(baseMessagePayload)
                ? baseMessagePayload
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
            const renderReplyTitle = () => {
                return {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*Required Approvers Count:* ${minimumApprovalCount}\n*Remaining Approvers:* ${requiredApprovers
                            .map((v) => `<@${v}>`)
                            .join(", ")}\n${approvers.length > 0
                            ? `Approvers: ${approvers.map((v) => `<@${v}>`).join(", ")} `
                            : ""}\n`,
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
            function approve(userId) {
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
            const mainMessage = baseMessageTs
                ? yield web.chat.update(Object.assign({ channel: channel_id, ts: baseMessageTs }, mainMessagePayload))
                : yield web.chat.postMessage(Object.assign({ channel: channel_id }, mainMessagePayload));
            const replyMessagePayload = {
                channel: channel_id,
                text: "",
                blocks: [renderReplyTitle(), renderReplyBody()],
            };
            if (!mainChannel) {
                replyMessagePayload.thread_ts = mainMessage.ts;
            }
            const replyMessage = yield web.chat.postMessage(replyMessagePayload);
            core.setOutput("mainMessageTs", mainMessage.ts);
            core.setOutput("replyMessageTs", replyMessage.ts);
            function cancelHandler() {
                return __awaiter(this, void 0, void 0, function* () {
                    yield web.chat.update(Object.assign({ ts: mainMessage.ts, channel: channel_id }, (hasPayload(failMessagePayload)
                        ? failMessagePayload
                        : mainMessagePayload)));
                    yield web.chat.update({
                        ts: replyMessage.ts,
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
                });
            }
            process.on("SIGTERM", cancelHandler);
            process.on("SIGINT", cancelHandler);
            process.on("SIGBREAK", cancelHandler);
            app.action("slack-approval-approve", ({ ack, client, body, logger, action }) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b;
                yield ack();
                if (action.type !== "button") {
                    return;
                }
                if (action.value !== aid) {
                    return;
                }
                const approveResult = approve(body.user.id);
                try {
                    if (approveResult === "approved") {
                        yield client.chat.update(Object.assign({ ts: mainMessage.ts || "", channel: ((_a = body.channel) === null || _a === void 0 ? void 0 : _a.id) || "" }, (hasPayload(successMessagePayload)
                            ? successMessagePayload
                            : mainMessagePayload)));
                    }
                    yield client.chat.update({
                        channel: ((_b = body.channel) === null || _b === void 0 ? void 0 : _b.id) || "",
                        ts: (replyMessage === null || replyMessage === void 0 ? void 0 : replyMessage.ts) || "",
                        text: "",
                        blocks: [renderReplyTitle(), renderReplyBody()],
                    });
                }
                catch (error) {
                    logger.error(error);
                }
                if (approveResult === "approved") {
                    process.exit(0);
                }
            }));
            app.action("slack-approval-reject", ({ ack, client, body, logger, action }) => __awaiter(this, void 0, void 0, function* () {
                var _c, _d, _e;
                yield ack();
                if (action.type !== "button") {
                    return;
                }
                if (action.value !== aid) {
                    return;
                }
                try {
                    const response_blocks = (_c = body.message) === null || _c === void 0 ? void 0 : _c.blocks;
                    response_blocks.pop();
                    response_blocks.push({
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: `Rejected by <@${body.user.id}> :x:`,
                        },
                    });
                    yield client.chat.update(Object.assign({ ts: mainMessage.ts || "", channel: ((_d = body.channel) === null || _d === void 0 ? void 0 : _d.id) || "" }, (hasPayload(failMessagePayload)
                        ? failMessagePayload
                        : mainMessagePayload)));
                    yield client.chat.update({
                        channel: ((_e = body.channel) === null || _e === void 0 ? void 0 : _e.id) || "",
                        ts: (replyMessage === null || replyMessage === void 0 ? void 0 : replyMessage.ts) || "",
                        text: "",
                        blocks: response_blocks,
                    });
                }
                catch (error) {
                    logger.error(error);
                }
                process.exit(1);
            }));
            (() => __awaiter(this, void 0, void 0, function* () {
                yield app.start(3000);
                console.log("Waiting Approval reaction.....");
            }))();
        }
        catch (error) {
            if (error instanceof Error)
                core.setFailed(error.message);
        }
    });
}
run();
