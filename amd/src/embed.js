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
 * Standalone embedded interaction viewer.
 *
 * @module     mod_flexbook/embed
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import $ from 'jquery';
import {get_string as getString} from 'core/str';
import {dispatchEvent} from 'core/event_dispatcher';
import Notification from 'core/notification';
import 'mod_interactivevideo/libraries/jquery-ui';
import state from './state';
import {safeParse} from './utils';
import messenger from './embed_messenger';

/**
 * Wire the floating fullscreen toggle on #wrapper.
 * @param {JQuery} $wrapper Wrapper element.
 */
const initFullscreenToggle = ($wrapper) => {
    const $button = $('#fb-embed-fullscreen');
    const $icon = $button.find('i');
    const wrapperEl = $wrapper.get(0);

    if (!$button.length || !wrapperEl || !wrapperEl.requestFullscreen) {
        $button.addClass('d-none');
        return;
    }

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            wrapperEl.requestFullscreen().catch((err) => {
                window.console.error(
                    `Error attempting to enable full-screen mode: ${err.message} (${err.name})`
                );
            });
            return;
        }
        document.exitFullscreen();
    };

    const syncFullscreenState = () => {
        const isFullscreen = document.fullscreenElement === wrapperEl;
        $icon.toggleClass('bi-fullscreen', !isFullscreen);
        $icon.toggleClass('bi-fullscreen-exit', isFullscreen);
        $wrapper.toggleClass('fullscreen', isFullscreen);
    };

    $button.on('click', (e) => {
        e.preventDefault();
        toggleFullscreen();
    });

    document.addEventListener('fullscreenchange', syncFullscreenState);
    syncFullscreenState();
};

/**
 * Initialise the standalone embed page.
 * @param {object} config Config from PHP.
 */
export const init = async(config) => {
    messenger.init({
        itemid: config.itemid,
        cmid: config.cmid,
        type: config.type || '',
        autoresize: false,
    });

    const annotation = safeParse($('#annotation').text(), null);
    const contentTypes = safeParse($('#contenttypes').text(), []);
    const doptions = safeParse($('#doptions').text(), {});

    if (!annotation || !annotation.type) {
        const message = await getString('invalidinteraction', 'mod_flexbook');
        Notification.addNotification({message, type: 'error'});
        messenger.notify('error', {message});
        return;
    }

    const contentType = contentTypes.find((item) => item.name === annotation.type);
    if (!contentType || !contentType.fbamdmodule) {
        const message = await getString('invalidinteractiontype', 'mod_flexbook', annotation.type);
        Notification.addNotification({message, type: 'error'});
        messenger.notify('error', {message});
        return;
    }

    state.config = {
        ...config,
        isEditMode: false,
        isPreviewMode: true,
        isEmbedMode: true,
        darkmode: doptions.darkmode == 1,
        completionid: null,
    };
    state.annotations = [annotation];
    state.ctRenderer = {};

    messenger.notify('ready', {
        itemid: config.itemid,
        type: annotation.type,
    });

    annotation.displayoptions = 'inline';
    annotation.prop = annotation.prop || JSON.stringify(contentType);

    const ctRenderer = {};
    await new Promise((resolve) => {
        require([contentType.fbamdmodule], (Type) => {
            ctRenderer[annotation.type] = new Type([annotation], contentType);
            state.ctRenderer = ctRenderer;
            resolve();
        });
    });

    state.currentanno = annotation;
    const $wrapper = $('#wrapper');
    initFullscreenToggle($wrapper);

    try {
        await ctRenderer[annotation.type].runEmbedInteraction(annotation, $wrapper);
        $wrapper.find(`#message[data-id="${annotation.id}"]`).addClass('active show');

        dispatchEvent('interactionrun', {annotation});

        messenger.notify('loaded', {
            itemid: config.itemid,
        });
    } catch (error) {
        window.console.error('Embed render failed:', error);
        messenger.notify('error', {message: String(error)});
        Notification.exception(error);
    }
};

export default {
    init,
};
