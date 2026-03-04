"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildReplyMessagePayload = void 0;
/**
 * Builds the payload for posting the approval (reply) message.
 * When mainChannel is true, omits thread_ts so the message appears in the channel main timeline.
 */
function buildReplyMessagePayload(options) {
    const payload = {
        channel: options.channelId,
        text: "",
        blocks: options.blocks,
    };
    if (!options.mainChannel) {
        payload.thread_ts = options.mainMessageTs;
    }
    return payload;
}
exports.buildReplyMessagePayload = buildReplyMessagePayload;
