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
 * Shared state for flexbook.
 *
 * @module     mod_flexbook/state
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

export default {
    /** @type {Object} The configuration settings for the Flexbook. */
    config: {},
    /** @type {Object} Interaction class instances indexed by content type name. */
    ctRenderer: {},

    /** @type {Array} The list of all annotations/interactions in the Flexbook. */
    annotations: [],

    /** @type {Array} The ordered sequence of annotation IDs. */
    sequence: [],

    /** @type {String} The current navigation direction ('next' or 'prev'). */
    direction: 'next',

    /** @type {Object|null} The currently active annotation object. */
    currentanno: null,

    /** @type {Object} Audio elements for interface sounds. */
    audio: {
        pop: null,
        point: null
    },

    /** @type {Function|null} Navigates to a specific interaction by ID or special identifier. */
    navigateToInteraction: null,

    /** @type {Function|null} Navigates to a specific annotation by ID. */
    navigateToAnnotation: null,

    /** @type {Function|null} Logic to navigate to the next available annotation. */
    nextAnnotation: null,

    /** @type {Function|null} Logic to navigate to the previous available annotation. */
    prevAnnotation: null,

    /** @type {Boolean} Indicates if the character mascot is currently active on screen. */
    isMascotActive: false,

    /** @type {Function|null} Triggers the mascot to display a specific message. */
    say: null,

    /** @type {Function|null} Triggers the mascot to display a random encouraging message. */
    sayRandom: null,

    /** @type {Function|null} Hides the mascot's speech bubble. */
    hideSay: null,

    /** @type {Function|null} Triggers a specific animation for the mascot. */
    animate: null,

    /** @type {Boolean} Indicates if navigation is allowed (e.g., after the start screen is dismissed). */
    ready: false
};
