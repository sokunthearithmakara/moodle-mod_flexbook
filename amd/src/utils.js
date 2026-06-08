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
 * Utility functions for flexbook.
 *
 * @module     mod_flexbook/utils
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
import $ from 'jquery';
import Fragment from 'core/fragment';

/** @type {number} Moodle FORMAT_MOODLE – preserves line breaks in plain text. */
export const FORMAT_MOODLE = 0;

/** @type {number} Moodle FORMAT_HTML. */
export const FORMAT_HTML = 1;

/**
 * Format text via the mod_flexbook format_text fragment (filters, pluginfile URLs).
 *
 * @param {string} text The text to format.
 * @param {number|null} contextid The context id.
 * @param {number} format Text format constant (e.g. FORMAT_MOODLE, FORMAT_HTML).
 * @param {number} itemid Item id for pluginfile URLs.
 * @returns {Promise<string>}
 */
export const formatContent = async (text, contextid = null, format = FORMAT_HTML, itemid = 0) => {
    return Fragment.loadFragment('mod_flexbook', 'format_text', contextid || M.cfg.contextid, {
        text: text,
        format: format,
        itemid: itemid,
    });
};

/**
 * Safely parse a JSON string, returning a fallback value if parsing fails.
 *
 * @param {string} str The string to parse.
 * @param {*} fallback The fallback value to return if parsing fails.
 * @returns {*} The parsed object or the fallback value.
 */
export const safeParse = (str, fallback = null) => {
    if (typeof str !== 'string') {
        return str || fallback;
    }
    try {
        return JSON.parse(str);
    } catch (e) {
        window.console.warn('Failed to parse JSON string:', str, e);
        return fallback;
    }
};

/**
 * Get the Moodle version branch.
 *
 * @returns {number} The Moodle version branch.
 */
export const getMoodleVersion = () => {
    if (typeof window.M.version === 'undefined' || window.M.version === null) {
        let version = $('#mod_flexbook_moodle_version').attr('data-version') || 403;
        window.M.version = parseInt(version);
    }
    return window.M.version;
};

