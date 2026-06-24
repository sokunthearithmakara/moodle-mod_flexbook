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
 * Helpers for global (singleton) interactions.
 *
 * Global interactions are activity-wide items that are not part of the learner
 * navigation sequence. They are flagged by a negative stored timestamp (-1),
 * which is assigned on create for content types declaring allowmultiple: false.
 *
 * @module     mod_flexbook/interaction-utils
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/**
 * Whether an interaction is global (not part of the navigation sequence).
 *
 * @param {Object} item The interaction record.
 * @returns {boolean}
 */
export const isGlobalInteraction = (item) => Number(item?.timestamp) < 0;

/**
 * Split annotations into global and sequential groups, preserving input order.
 *
 * @param {Object[]} annotations The interaction records.
 * @returns {{global: Object[], sequential: Object[]}}
 */
export const partitionAnnotations = (annotations) => ({
    global: annotations.filter(isGlobalInteraction),
    sequential: annotations.filter((a) => !isGlobalInteraction(a)),
});

/**
 * Order annotations for the editor list: globals pinned on top (stable by type
 * then id), followed by sequential items in the saved sequence order.
 *
 * @param {Object[]} annotations The interaction records.
 * @param {Array} sequenceIds The saved sequence of sequential item ids.
 * @returns {Object[]}
 */
export const sortForEditList = (annotations, sequenceIds) => {
    const {global, sequential} = partitionAnnotations(annotations);
    const sequenced = (sequenceIds || [])
        .map((id) => sequential.find((a) => String(a.id) === String(id)))
        .filter(Boolean);
    // Append any sequential items missing from the sequence (defensive).
    sequential.forEach((a) => {
        if (!sequenced.includes(a)) {
            sequenced.push(a);
        }
    });
    global.sort((a, b) => String(a.type).localeCompare(String(b.type)) || a.id - b.id);
    return [...global, ...sequenced];
};

/**
 * Build the learner navigation sequence (sequential items only).
 *
 * @param {Object[]} annotations The interaction records.
 * @returns {string[]}
 */
export const buildNavigationSequence = (annotations) =>
    partitionAnnotations(annotations).sequential.map((a) => a.id.toString());

/**
 * Move all global rows to the top of the editor list in the DOM, keeping a
 * stable order. Used after a sortable drag so globals can never be displaced.
 *
 * @param {jQuery} $list The #annotation-list element.
 * @returns {void}
 */
export const enforceGlobalPrefixInDom = ($list) => {
    const $globals = $list.find('tr.global-interaction').not('.deleted');
    if (!$globals.length) {
        return;
    }
    const sorted = $globals.get().sort((a, b) => {
        const typeA = String(a.getAttribute('data-type') || '');
        const typeB = String(b.getAttribute('data-type') || '');
        return typeA.localeCompare(typeB)
            || (Number(a.getAttribute('data-id')) - Number(b.getAttribute('data-id')));
    });
    // Prepend in reverse so the first sorted row ends up first.
    sorted.reverse().forEach((row) => $list.prepend(row));
};
