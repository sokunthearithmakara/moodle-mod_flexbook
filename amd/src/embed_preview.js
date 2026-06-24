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
 * Open flexbook/embed.php in a modal for edit-mode interaction preview.
 *
 * @module     mod_flexbook/embed_preview
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
import $ from 'jquery';
import ModalEvents from 'core/modal_events';
import {get_string as getString} from 'core/str';
import state from 'mod_flexbook/state';
import embedParent from 'mod_flexbook/embed_parent';

let ModalFactory = null;
let activeEmbedModal = null;
let activeEmbedCleanup = null;

/**
 * Build a flexbook embed.php URL for an interaction id.
 *
 * @param {number|string} itemId flexbook_items.id
 * @param {Object} [options]
 * @param {boolean} [options.darkmode]
 * @param {boolean} [options.kid]
 * @return {string}
 */
export const buildEmbedUrl = (itemId, options = {}) => {
    const url = new URL(`${M.cfg.wwwroot}/mod/flexbook/embed.php`);
    url.searchParams.set('id', String(itemId));
    if (options.darkmode) {
        url.searchParams.set('dm', '1');
    }
    if (options.kid) {
        url.searchParams.set('kid', '1');
    }
    return url.toString();
};

/**
 * Resolve navigation target id to an embeddable interaction.
 *
 * @param {string|number} id Target id or navigation special.
 * @return {Promise<{itemId: number|string, title: string}|null>}
 */
export const resolveEmbedNavigationTarget = async(id) => {
    let resolvedId = id;
    const sequence = state.sequence || [];
    const annotations = state.annotations || [];
    const currentId = state.currentanno?.id;

    if (resolvedId === 'endscreen') {
        return null;
    }
    if (resolvedId === 'firstpage' || resolvedId === 'first') {
        resolvedId = sequence[0];
    } else if (resolvedId === 'previousinteraction') {
        const index = currentId ? sequence.indexOf(String(currentId)) : 0;
        resolvedId = index > 0 ? sequence[index - 1] : sequence[0];
    } else if (resolvedId === 'nextinteraction') {
        const index = currentId ? sequence.indexOf(String(currentId)) : -1;
        resolvedId = (index >= 0 && index < sequence.length - 1) ? sequence[index + 1] : null;
    }

    if (!resolvedId) {
        return null;
    }
    if (typeof resolvedId === 'string' && resolvedId.startsWith('@@ANNOID#')) {
        resolvedId = resolvedId.replace('@@ANNOID#', '');
    }

    const annotation = annotations.find((item) => String(item.id) === String(resolvedId));
    if (!annotation) {
        return null;
    }

    return {
        itemId: annotation.id,
        title: annotation.title || await getString('embedinteraction', 'mod_flexbook'),
    };
};

const getModalFactory = async() => {
    if (!ModalFactory) {
        let module;
        if (window.M.version >= 403 || document.body.classList.contains('bs-5')) {
            module = await import('core/modal');
        } else {
            module = await import('core/modal_factory');
        }
        ModalFactory = module.default || module;
    }
    return ModalFactory;
};

const closeActiveEmbedPreview = () => {
    if (activeEmbedCleanup) {
        activeEmbedCleanup();
        activeEmbedCleanup = null;
    }
    if (activeEmbedModal) {
        try {
            activeEmbedModal.hide();
        } catch (e) {
            // Ignore.
        }
        activeEmbedModal = null;
    }
    $('.fb-embed-preview-modal').remove();
};

/**
 * Open embed.php for a single interaction inside a modal iframe.
 *
 * @param {Object} options
 * @param {number|string} options.itemId flexbook_items.id
 * @param {string} [options.title]
 * @param {boolean} [options.darkmode]
 * @return {Promise<boolean>}
 */
export const openEmbedPreview = async({itemId, title = '', darkmode = false}) => {
    if (!itemId) {
        return false;
    }

    closeActiveEmbedPreview();

    await getModalFactory();
    const embedUrl = buildEmbedUrl(itemId, {darkmode});
    const iframeId = `fb-embed-preview-${Date.now()}`;
    const closeId = `fb-embed-preview-close-${Date.now()}`;
    const modalDomId = `fb-embed-preview-modal-${Date.now()}`;
    const closeLabel = await getString('close', 'mod_interactivevideo');
    const minHeight = 480;

    const modal = await ModalFactory.create({
        title: '',
        large: true,
        body: '',
        removeOnClose: true,
        isVerticallyCentered: true,
    });

    return new Promise((resolve) => {
        const root = modal.getRoot();
        root.attr('id', modalDomId).addClass('fb-embed-preview-modal modal');

        root.on('click', `#${closeId}`, (e) => {
            e.preventDefault();
            root.fadeOut(300, () => modal.hide());
        });

        root.on(ModalEvents.hidden, () => {
            closeActiveEmbedPreview();
            modal.destroy();
        });

        root.on(ModalEvents.shown, () => {
            const $title = root.find('.modal-header')
                .addClass('shadow-sm d-flex align-items-center justify-content-between');
            if ($('body').hasClass('darkmode')) {
                $title.addClass('btn-dark');
            }
            const $btns = $('<div class="d-flex align-items-center flex-shrink-0">').append(
                $('<button type="button" class="btn p-0 border-0">')
                    .attr({id: closeId, 'aria-label': closeLabel, title: closeLabel})
                    .html('<i class="bi bi-x-lg" aria-hidden="true"></i>')
            );
            $title.empty();
            if (title) {
                $title.append($('<h5 class="modal-title text-truncate mb-0">').text(title));
            }
            $title.append($btns);

            const $body = root.find('.modal-body').addClass('p-0');
            $body.html(
                `<div class="fb-embed-preview-wrapper" style="position:relative;width:100%;min-height:${minHeight}px;">`
                + `<iframe id="${iframeId}" class="fb-embed-preview-iframe w-100 border-0" `
                + `src="${embedUrl}" style="min-height:${minHeight}px;height:${minHeight}px;" `
                + `title="${title.replace(/"/g, '&quot;')}"></iframe>`
                + `</div>`
            );

            activeEmbedCleanup = embedParent.init(`#${iframeId}`, {minHeight});
            activeEmbedModal = modal;
            resolve(true);
        });

        modal.show();
    });
};

/**
 * Resolve a navigation id and open embed.php preview.
 *
 * @param {string|number} id
 * @param {boolean} [darkmode]
 * @return {Promise<boolean>}
 */
export const openEmbedPreviewByNavigationId = async(id, darkmode = $('body').hasClass('darkmode')) => {
    const target = await resolveEmbedNavigationTarget(id);
    if (!target) {
        return false;
    }
    return openEmbedPreview({
        itemId: target.itemId,
        title: target.title,
        darkmode,
    });
};

export default {
    buildEmbedUrl,
    resolveEmbedNavigationTarget,
    openEmbedPreview,
    openEmbedPreviewByNavigationId,
};
