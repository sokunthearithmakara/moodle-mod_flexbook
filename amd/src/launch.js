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
 * Opens the book in a full viewport popup from the start-screen-only page.
 *
 * @module     mod_flexbook/launch
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
import $ from 'jquery';
import Ajax from 'core/ajax';
import Templates from 'core/templates';

let popup = null;

/**
 * The modal API: core/modal from Moodle 4.3, core/modal_factory before that.
 *
 * @returns {Promise<Object>} An object with a create() method.
 */
const getModalFactory = async() => {
    const Modal = await import('core/modal');
    if ((Modal.default || Modal).create) {
        return Modal.default || Modal;
    }
    const ModalFactory = await import('core/modal_factory');
    return ModalFactory.default || ModalFactory;
};

/**
 * Offers "Show more" only when the description is longer than the space it is given.
 *
 * @param {jQuery} $cover The cover.
 */
const setUpCover = ($cover) => {
    const clamp = $cover.find('.fb-cover-clamp').get(0);
    if (!clamp) {
        return;
    }
    const check = () => {
        const button = $cover.find('[data-action="fbshowmore"]').get(0);
        if (button && !clamp.classList.contains('is-expanded')) {
            button.hidden = clamp.scrollHeight <= clamp.clientHeight + 1;
        }
    };
    check();
    // Images in the description change its height as they load.
    clamp.querySelectorAll('img').forEach((img) => img.addEventListener('load', check, {once: true}));
};

/**
 * Closes the popup and brings the page up to date, without a reload where possible.
 *
 * @param {Object} modal The popup.
 * @param {jQuery} $frame The cover.
 */
const closePopup = async(modal, $frame) => {
    if (modal.closing) {
        return;
    }
    modal.closing = true;
    const root = modal.getRoot();
    const iframe = root.find('#fbplayer').get(0);

    // This page's own flag: it was not complete on load and others depend on it. The book in the iframe
    // records its view before it checks, so it may already count itself complete and leave the flag off.
    const withavailability = document.body.classList.contains('withavailability');
    // Save the learner's place before the iframe and its document go.
    try {
        const win = iframe?.contentWindow;
        if (win?.flexbookSaveProgress) {
            await win.flexbookSaveProgress();
        }
    } catch (error) {
        // The book had not loaded: there is nothing to save.
    }
    // Hiding moves the modal in the DOM, which would reload a remaining iframe and record another view.
    root.find('#fbplayer').remove();

    let reload = false;
    let $cover = $frame;
    try {
        const data = await Ajax.call([{
            methodname: 'mod_flexbook_get_cover',
            args: {cmid: Number($frame.data('id')), contextid: Number($frame.data('contextid'))},
        }])[0];
        // Finishing may unlock other activities, which only a reload shows.
        reload = withavailability && data.overallcompletion;
        if (!reload) {
            // The cover again, with the learner's completion, progress and outcome ratings as they are now.
            $cover = $(data.html.trim());
            $frame.replaceWith($cover);
            setUpCover($cover);
        }
    } catch (error) {
        // The cover shows where the learner stood when the page loaded, until the next visit.
    }
    if (reload) {
        window.location.reload();
        return;
    }

    // Our hide() would come back here: use the real one again to take the modal down.
    delete modal.hide;
    modal.destroy();
    popup = null;
    $cover.find('[data-action="fbopen"]').trigger('focus');
};

/**
 * Opens the book in the popup.
 *
 * @param {jQuery} $frame The cover.
 */
const openPopup = async($frame) => {
    if (popup) {
        return;
    }
    popup = true;
    try {
        const Factory = await getModalFactory();
        const modal = await Factory.create({
            body: await Templates.render('mod_flexbook/launchmodal', {
                wwwroot: M.cfg.wwwroot,
                id: $frame.data('id'),
                name: $frame.data('name'),
            }),
            show: false,
            removeOnClose: false,
        });
        popup = modal;
        const root = modal.getRoot();
        root.addClass('fb-launch-modal');
        root.find('.modal-dialog').addClass('modal-fullscreen');
        root.find('.modal-header').remove();
        root.find('.modal-footer').remove();

        // Every way out (back arrow, Escape) goes through closePopup.
        modal.hide = () => closePopup(modal, $frame);
        root.on('click', '[data-action="hidemodal"]', (e) => {
            e.preventDefault();
            closePopup(modal, $frame);
        });

        modal.show();
        root.find('#fbplayer').trigger('focus');
    } catch (error) {
        popup = null;
        window.console.error(error);
    }
};

export const init = () => {
    setUpCover($('#flexbook-cover'));

    $(document).on('click', '#flexbook-cover [data-action="fbopen"]', function(e) {
        e.preventDefault();
        openPopup($(this).closest('#flexbook-cover'));
    });

    // Show more or less of the description, and show or hide the outcomes.
    $(document).on('click', '#flexbook-cover [data-action="fbshowmore"], #flexbook-cover [data-action="fbtoggle"]',
        function(e) {
            e.preventDefault();
            const expanded = this.getAttribute('aria-expanded') !== 'true';
            const target = document.getElementById(this.getAttribute('aria-controls'));
            this.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            if (this.dataset.action === 'fbshowmore') {
                target.classList.toggle('is-expanded', expanded);
            } else {
                target.hidden = !expanded;
            }
        });
};
