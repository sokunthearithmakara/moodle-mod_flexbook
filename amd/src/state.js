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
    config: {},
    annotations: [],
    sequence: [],
    direction: 'next',
    currentanno: null,
    audio: {
        pop: null,
        point: null
    },
    navigateToAnnotation: null,
    nextAnnotation: null,
    prevAnnotation: null,
    isMascotActive: false,
    say: null,
    sayRandom: null,
    hideSay: null,
    animate: null
};
