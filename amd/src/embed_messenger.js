// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * postMessage bridge for standalone embed.php iframes.
 *
 * @module     mod_flexbook/embed_messenger
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const SOURCE = 'mod_flexbook/embed';
const PARENT_SOURCE = 'mod_flexbook/embed_parent';
const VERSION = 1;
const RESIZE_DEBOUNCE_MS = 100;
/** Minimum height reported to parent iframes (avoids collapsed strip). */
const MIN_REPORTED_HEIGHT = 200;

/** @type {object|null} */
let meta = null;

/** @type {boolean} */
let autoresizeEnabled = false;

/** @type {ResizeObserver|null} */
let resizeObserver = null;

/** @type {number|null} */
let resizeTimer = null;

/** @type {Function|null} */
let parentMessageHandler = null;

/**
 * Whether this page runs inside an iframe.
 * @returns {boolean}
 */
export const isFramed = () => window.parent !== window;

/**
 * Best-effort pixel height for a single element.
 * @param {Element|null} el Element to measure.
 * @returns {number}
 */
const elementHeight = (el) => {
    if (!el) {
        return 0;
    }
    const rect = el.getBoundingClientRect();
    return Math.ceil(Math.max(el.scrollHeight, el.offsetHeight, rect.height));
};

/**
 * Measure the document content height for parent iframe sizing.
 *
 * Uses the maximum of document, wrapper, and #message heights so flex/overflow
 * layouts do not collapse the reported value.
 *
 * @param {Element|null} target Optional legacy target (included in the max).
 * @returns {number}
 */
export const measureHeight = (target = null) => {
    const parts = [
        document.documentElement ? document.documentElement.scrollHeight : 0,
        document.documentElement ? document.documentElement.offsetHeight : 0,
        document.body ? document.body.scrollHeight : 0,
        document.body ? document.body.offsetHeight : 0,
    ];

    const wrapper = document.getElementById('wrapper');
    const message = document.getElementById('message');
    const previewIframe = document.querySelector('#message .preview-iframe');
    if (wrapper) {
        parts.push(elementHeight(wrapper));
    }
    if (message) {
        parts.push(elementHeight(message));
    }
    if (previewIframe) {
        parts.push(elementHeight(previewIframe));
        const style = previewIframe.getAttribute('style') || '';
        const pbMatch = style.match(/padding-bottom:\s*([^;]+)/i);
        if (pbMatch && String(pbMatch[1]).includes('%')) {
            const pct = parseFloat(pbMatch[1]);
            if (!Number.isNaN(pct) && pct > 0 && previewIframe.offsetWidth > 0) {
                parts.push(Math.ceil(previewIframe.offsetWidth * pct / 100));
            }
        }
    }
    if (target && target !== document.documentElement && target !== document.body) {
        parts.push(elementHeight(target));
    }

    return Math.max(MIN_REPORTED_HEIGHT, ...parts);
};

/**
 * Post a namespaced message to the parent window.
 * @param {string} type Message type.
 * @param {object} payload Payload data.
 */
export const notify = (type, payload = {}) => {
    if (!isFramed() || !meta) {
        return;
    }
    if ((type === 'loaded' || type === 'resize') && payload.height === undefined) {
        payload.height = measureHeight();
    }
    window.parent.postMessage({
        source: SOURCE,
        version: VERSION,
        type,
        itemid: meta.itemid,
        payload,
    }, '*');
};

/**
 * Debounced resize notification.
 */
const notifyResize = () => {
    if (!autoresizeEnabled) {
        return;
    }
    if (resizeTimer) {
        clearTimeout(resizeTimer);
    }
    resizeTimer = setTimeout(() => {
        notify('resize', {height: measureHeight()});
    }, RESIZE_DEBOUNCE_MS);
};

/**
 * Post immediate resize messages (e.g. after async content paints).
 * @param {number[]} [delays=[250, 750, 1500]] Delays in ms.
 */
export const scheduleFollowUpResizes = (delays = [250, 750, 1500]) => {
    if (!isFramed() || !autoresizeEnabled) {
        return;
    }
    delays.forEach((delay) => {
        setTimeout(() => {
            notify('resize', {height: measureHeight()});
        }, delay);
    });
};

/**
 * Start observing content height changes.
 * @param {Element|Element[]|null} targets Elements to observe (defaults to body, wrapper, message).
 */
export const startAutoResize = (targets = null) => {
    if (!isFramed() || !autoresizeEnabled) {
        return;
    }

    let observeTargets = targets;
    if (!observeTargets) {
        observeTargets = [
            document.body,
            document.getElementById('wrapper'),
            document.getElementById('message'),
            document.querySelector('#message .preview-iframe'),
        ].filter(Boolean);
    } else if (!Array.isArray(observeTargets)) {
        observeTargets = [observeTargets];
    }

    notify('resize', {height: measureHeight()});

    if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => notifyResize());
        observeTargets.forEach((target) => resizeObserver.observe(target));
    }

    window.addEventListener('resize', () => notifyResize());
};

/**
 * Stop auto-resize observation.
 */
export const stopAutoResize = () => {
    if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
    }
    if (resizeTimer) {
        clearTimeout(resizeTimer);
        resizeTimer = null;
    }
};

/**
 * Register a handler for inbound parent messages (phase 2 stub).
 * @param {Function} handler Callback receiving the message envelope.
 */
export const onParentMessage = (handler) => {
    parentMessageHandler = handler;
    if (window.__fbEmbedParentListener) {
        return;
    }
    window.__fbEmbedParentListener = true;
    window.addEventListener('message', (event) => {
        const data = event.data;
        if (!data || data.source !== PARENT_SOURCE || !parentMessageHandler) {
            return;
        }
        if (event.source !== window.parent) {
            return;
        }
        parentMessageHandler(data, event);
    });
};

/**
 * Initialise the embed messenger.
 * @param {object} options Options.
 * @param {number} options.itemid Interaction id.
 * @param {number} options.cmid Course module id.
 * @param {string} options.type Interaction type name.
 * @param {boolean} [options.autoresize=true] Whether to post resize messages.
 */
export const init = (options) => {
    meta = {
        itemid: options.itemid,
        cmid: options.cmid,
        type: options.type,
    };
    autoresizeEnabled = options.autoresize === true;

    onParentMessage(() => {
        // Phase 2: handle inbound commands from parent.
    });
};

export default {
    init,
    notify,
    measureHeight,
    startAutoResize,
    stopAutoResize,
    scheduleFollowUpResizes,
    onParentMessage,
    isFramed,
};
