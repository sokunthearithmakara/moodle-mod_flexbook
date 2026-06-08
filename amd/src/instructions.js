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
 * Instructions sidebar for flexbook interactions.
 *
 * @module     mod_flexbook/instructions
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import $ from 'jquery';
import {get_string as getString} from 'core/str';
import {notifyFilterContentUpdated} from 'core_filters/events';
import {safeParse, formatContent, FORMAT_MOODLE, FORMAT_HTML} from './utils';
import state from './state';

const $body = $('body');
let $wrapper = $('#wrapper');
let currentAnnotationId = null;
let isOpen = false;

/**
 * Whether instructions should be available for this annotation.
 *
 * @param {Object} annotation
 * @returns {boolean}
 */
export const shouldShowInstructions = (annotation) => {
    const advanced = safeParse(annotation.advanced, {});
    const instructions = (advanced.instructions || '').trim();
    if (instructions === '') {
        return false;
    }
    if (advanced.hideinstructionsoncomplete == 1 && annotation.completed) {
        return false;
    }
    return true;
};

/**
 * Get the mount element for the instructions sidebar.
 *
 * @returns {jQuery}
 */
const getMount = () => {
    const $modal = $('#annotation-modal:visible');
    if ($modal.length) {
        return $modal;
    }
    const $editorStage = $('#editor-stage');
    if ($editorStage.length) {
        return $editorStage;
    }
    if (!$wrapper.length) {
        $wrapper = $('#wrapper');
    }
    return $wrapper;
};

/**
 * Slide the instructions panel closed without destroying it.
 */
const closePanel = () => {
    const $sidebar = $('#instructions-sidebar');
    if (!$sidebar.length) {
        return;
    }
    $sidebar.addClass('hide');
    $body.removeClass('hassidebar');
    $('#instructions-toggle').attr('aria-pressed', 'false').removeClass('active');
    isOpen = false;
};

/**
 * Slide the instructions panel open.
 */
const openPanel = () => {
    const $sidebar = $('#instructions-sidebar');
    if (!$sidebar.length) {
        return;
    }
    $sidebar.removeClass('hide');
    $body.addClass('hassidebar');
    $('#instructions-toggle').attr('aria-pressed', 'true').addClass('active');
    isOpen = true;
};

/**
 * Toggle the instructions panel open/closed.
 */
const togglePanel = () => {
    if (isOpen) {
        closePanel();
    } else {
        openPanel();
    }
};

/**
 * Remove the instructions sidebar and reset state.
 */
export const destroy = () => {
    $(document).off('click.fb-instructions');
    $('#instructions-sidebar').off('.fb-instructions').remove();
    $body.removeClass('hassidebar');
    $('#instructions-toggle').attr('aria-pressed', 'false').removeAttr('aria-controls').removeClass('active');
    currentAnnotationId = null;
    isOpen = false;
};

/**
 * Build and attach the instructions sidebar for an interaction.
 *
 * @param {Object} annotation
 * @returns {Promise<void>}
 */
export const render = async(annotation) => {
    destroy();

    if (!shouldShowInstructions(annotation)) {
        return;
    }

    const advanced = safeParse(annotation.advanced, {});
    const instructions = (advanced.instructions || '').trim();
    const format = advanced.instructionsformat == FORMAT_MOODLE ? FORMAT_MOODLE : FORMAT_HTML;
    const formatted = await formatContent(instructions, annotation.contextid, format);
    const [title, closeLabel] = await Promise.all([
        getString('instructions', 'mod_flexbook'),
        getString('close', 'mod_interactivevideo'),
    ]);

    const $mount = getMount();
    const $sidebar = $(`
        <div id="instructions-sidebar"
             class="iv-sidebar hide p-0"
             role="complementary"
             aria-label="${title}">
            <div class="fb-instructions-header shadow-sm border-bottom d-flex align-items-center justify-content-between">
                <h6 class="modal-title mb-0 d-flex align-items-center">
                    <i class="bi bi-journal-text fs-25px iv-mr-2" aria-hidden="true"></i>${title}
                </h6>
                <button type="button"
                        class="btn btn-flex fb-title-action p-0 border-0"
                        id="instructions-close"
                        aria-label="${closeLabel}">
                    <i class="bi bi-x-lg fs-25px" aria-hidden="true"></i>
                </button>
            </div>
            <div class="fb-instructions-body"></div>
        </div>
    `);
    const $instructionsBody = $sidebar.find('.fb-instructions-body');
    $instructionsBody.html(formatted);
    $mount.append($sidebar);
    $('#instructions-toggle').attr('aria-controls', 'instructions-sidebar');

    const bodyEl = $instructionsBody[0];
    if (bodyEl) {
        notifyFilterContentUpdated(bodyEl);
    }

    currentAnnotationId = annotation.id;

    $(document).on('click.fb-instructions', '#instructions-toggle', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).tooltip?.('hide');
        togglePanel();
    });

    $sidebar.find('#instructions-close').on('click.fb-instructions', function(e) {
        e.preventDefault();
        e.stopPropagation();
        closePanel();
    });

    if (!state.config?.isEditMode) {
        openPanel();
    }
};

/**
 * Register lifecycle listeners.
 */
export const init = () => {
    $(document).on('interactionrun', async function(e) {
        await render(e.detail.annotation);
    });

    $(document).on('interactionclose', function(e) {
        const closingId = e.detail?.annotation?.id;
        // During navigation, interactionrun for the new item fires before interactionclose for the old one.
        if (closingId && currentAnnotationId && closingId != currentAnnotationId) {
            return;
        }
        destroy();
    });

    $(document).on('interactionrefresh', function() {
        destroy();
    });
};
