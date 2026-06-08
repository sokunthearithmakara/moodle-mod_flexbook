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
 * Parent-page helper for flexbook embed iframes (auto-resize).
 *
 * @module     mod_flexbook/embed_parent
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import $ from 'jquery';

const SOURCE = 'mod_flexbook/embed';

/**
 * Apply height from embed message to iframe.
 * @param {HTMLIFrameElement} iframe Target iframe.
 * @param {number} height Content height in px.
 * @param {number} minHeight Minimum height in px.
 */
const applyHeight = (iframe, height, minHeight) => {
    if (!height || !iframe) {
        return;
    }
    const next = Math.max(minHeight, Math.ceil(height));
    iframe.style.height = next + 'px';
};

/**
 * Listen for embed postMessages and resize the iframe.
 * @param {HTMLIFrameElement|string|JQuery} iframeOrSelector iframe element or selector.
 * @param {object} [options] Options.
 * @param {number} [options.minHeight=200] Minimum iframe height in px.
 * @returns {Function} Cleanup function to remove the listener.
 */
export const init = (iframeOrSelector, options = {}) => {
    const minHeight = options.minHeight || 200;
    const $iframe = $(iframeOrSelector);
    const iframe = $iframe.get(0);

    if (!iframe || iframe.tagName !== 'IFRAME') {
        return () => {
            // No listener registered.
        };
    }

    const handler = (event) => {
        const data = event.data;
        if (!data || data.source !== SOURCE) {
            return;
        }
        if (data.type !== 'resize' && data.type !== 'loaded') {
            return;
        }
        if (event.source !== iframe.contentWindow) {
            return;
        }
        applyHeight(iframe, data.payload?.height, minHeight);
    };

    window.addEventListener('message', handler);

    return () => {
        window.removeEventListener('message', handler);
    };
};

export default {
    init,
};
