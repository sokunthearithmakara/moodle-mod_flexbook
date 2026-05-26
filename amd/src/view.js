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
 * View module for flexbook
 *
 * @module     mod_flexbook/view
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import $ from 'jquery';
import {get_string as getString, get_strings as getStrings} from 'core/str';
import {dispatchEvent} from 'core/event_dispatcher';
import {add as addToast} from './toast';
import Ajax from 'core/ajax';
import Notification from 'core/notification';
import 'mod_interactivevideo/libraries/jquery-ui';
import state from './state';
import {safeParse} from './utils';

const isBS5 = $('body').hasClass('bs-5');
const bsAffix = isBS5 ? '-bs' : '';
const $body = $('body');

let $wrapper = $('#wrapper');
let $videowrapper = $('#video-wrapper');
let $startscreen = $('#start-screen');
let uprogress = null;
let annotations; // Array of annotations.
let contentTypes; // Array of available content types.
let doptions; // Display options.
let completionid; // Id of the completion record.
let sequence; // Sequence of annotations.

const $controlBar = $('#controller');
const $annotationbar = $controlBar.find('.top-bar');

const init = async config => {
    // Move toast-wrapper to the #wrapper element so it can be displayed on top of the video in fullscreen mode.
    let $toast = $('.toast-wrapper').detach();
    $wrapper.append($toast);

    doptions = safeParse($('#doptions').text(), {});
    annotations = safeParse($('#annotations').text(), []);
    contentTypes = safeParse($('#contenttypes').text(), []);
    uprogress = safeParse($('#progress').text(), {});
    sequence = $('#sequence').text().split(',');
    let ctRenderer = {};
    state.ctRenderer = ctRenderer;

    // Set completion id for later use.
    completionid = uprogress.id || null;
    state.config = {
        token: null,
        extendedcompletion: null,
        isCompleted: false,
        iseditor: false,
        isGuest: false,
        ...config,
        completionid,
        isEditMode: false,
        isPreviewMode: false,
        darkmode: doptions.darkmode == 1
    };

    const isEmbed = new URLSearchParams(window.location.search).get('embed') === '1';
    const isSmallScreen = window.innerWidth < 768;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isMobileApp = typeof window.MoodleApp !== 'undefined' || document.body.classList.contains('path-mod-flexbook-mobile');

    const shouldShowMascot = document.body.classList.contains('kidtheme') && doptions.character && doptions.character !== 'none'
        && !isEmbed && !isSmallScreen && !isMobile && !isMobileApp;

    if (shouldShowMascot) {
        const MascotModule = await import('mod_flexbook/character');
        const Mascot = MascotModule.default || MascotModule;
        Mascot.init(doptions.character, config.firstname, config.new);
    }

    // Initialize interaction tracking data from saved progress (resumable).
    const interactionData = safeParse(uprogress.details, {});
    state.interactionData = interactionData;
    let interactionStartTime = null;
    let trackingAnnotationId = null;

    /**
     * Returns the total accumulated timespent for an annotation in milliseconds,
     * including any currently-running live elapsed time not yet flushed.
     *
     * @param {number|string} id - The annotation ID.
     * @returns {number} Total ms spent on the annotation.
     */
    state.getTimespent = (id) => {
        const saved = (interactionData[id] && interactionData[id].t) || 0;
        const live = (trackingAnnotationId == id && interactionStartTime !== null)
            ? Date.now() - interactionStartTime
            : 0;
        return saved + live;
    };

    const pauseInteractionTimer = () => {
        // Flush elapsed time into the total, but keep trackingAnnotationId so we can resume.
        if (trackingAnnotationId !== null && interactionStartTime !== null) {
            const elapsed = Date.now() - interactionStartTime;
            if (!interactionData[trackingAnnotationId]) {
                interactionData[trackingAnnotationId] = {t: 0, v: 0};
            }
            interactionData[trackingAnnotationId].t = (interactionData[trackingAnnotationId].t || 0) + elapsed;
            interactionStartTime = null; // Paused – not tracking anymore but annotation id preserved.
            state.interactionData = interactionData;
        }
    };

    const resumeInteractionTimer = () => {
        // Restart the clock for whatever annotation was running before the pause.
        if (trackingAnnotationId !== null && interactionStartTime === null) {
            interactionStartTime = Date.now();
        }
    };

    const stopInteractionTimer = () => {
        pauseInteractionTimer();
        trackingAnnotationId = null; // Fully reset – no annotation is active.
    };

    const dismissedInstructions = new Set();
    $(document).on('fb:instructiondismissed', (e, data) => {
        if (data && data.id) {
            dismissedInstructions.add(data.id);
        }
    });

    $(document).on('interactionrun', function(e) {
        stopInteractionTimer(); // Flush any previously running timer.
        const annotation = e.detail.annotation;
        const id = annotation.id;
        if (!interactionData[id]) {
            interactionData[id] = {t: 0, v: 0};
        }
        interactionData[id].v = (interactionData[id].v || 0) + 1;
        trackingAnnotationId = id;
        interactionStartTime = Date.now();
        state.interactionData = interactionData;

        // Show instructions if available.
        const advanced = safeParse(annotation.advanced, {});
        if (advanced.instructions && advanced.instructions.trim() !== "") {
            // Check if already dismissed in this session.
            if (dismissedInstructions.has(id)) {
                return;
            }

            // Check if 'Hide on completion' is enabled and interaction is completed.
            if (advanced.hideinstructionsoncomplete == 1 && annotation.completed) {
                return;
            }

            if (state.isMascotActive && state.say) {
                state.say(advanced.instructions, 0, id); // Persistent bubble
            } else {
                // Show pop-up at bottom right.
                $('#instruction-popup').remove();
                const $popup = $(`
                    <div id="instruction-popup">
                        <div class="popup-content">${advanced.instructions}</div>
                        <button class="popup-close"><i class="fa fa-close"></i></button>
                    </div>
                `);
                $popup.find('.popup-close').on('click', () => {
                    dismissedInstructions.add(id);
                    $popup.fadeOut(300, () => $popup.remove());
                });
                $wrapper.append($popup);
            }
        }
    });

    $(document).on('interactionclose interactionrefresh', function() {
        stopInteractionTimer();
        if (state.hideSay) {
            state.hideSay();
        }
        $('#instruction-popup').fadeOut(300, () => $('#instruction-popup').remove());
    });

    $(document).on('fb:ended', function() {
        if (!uprogress.timeended && !state.reachendSent) {
            saveInteractionData(true);
            state.reachendSent = true;
        } else {
            saveInteractionData(false);
        }
    });

    let isSaving = false;
    const saveInteractionData = (reachend = false) => {
        if (isSaving && !reachend) {
            return;
        }
        pauseInteractionTimer(); // Flush without resetting trackingAnnotationId.
        const lastviewed = state.currentanno ? state.currentanno.id : 0;
        const args = {
            contextid: M.cfg.contextid,
            completionid: state.config.completionid || 0,
            details: JSON.stringify(interactionData),
            lastviewed,
            reachend,
        };

        if (reachend) {
            Ajax.call([{
                methodname: 'mod_flexbook_save_interaction_data',
                args
            }])[0].then(response => {
                const data = safeParse(response.data, {});
                if (data.overallcomplete) {
                    state.config.isCompleted = true;
                }
                dispatchEvent('flexbook:reached_end');
                return data;
            }).catch(e => window.console.error(e));
        } else {
            isSaving = true;
            const url = `${M.cfg.wwwroot}/lib/ajax/service.php?sesskey=${M.cfg.sesskey}`;
            const body = JSON.stringify([{index: 0, methodname: 'mod_flexbook_save_interaction_data', args}]);
            navigator.sendBeacon(url, new Blob([body], {type: 'application/json'}));

            // Allow subsequent saves after a short delay (e.g. if the user stays on page).
            setTimeout(() => {
                isSaving = false;
            }, 1000);
        }
    };

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            saveInteractionData();
        } else if (document.visibilityState === 'visible') {
            resumeInteractionTimer();
        }
    });

    window.addEventListener('pagehide', () => {
        saveInteractionData();
    });

    window.addEventListener('beforeunload', () => {
        saveInteractionData();
    });

    $startscreen.find('#start').focus();

    const toggleFullscreen = () => {
        const elem = document.getElementById('wrapper');
        if (!document.fullscreenElement) {
            elem.requestFullscreen().catch(err => {
                window.console.error(
                    `Error attempting to enable full-screen mode: ${err.message} (${err.name})`
                );
            });
        } else {
            document.exitFullscreen();
        }
    };

    const resizeVideoWrapper = () => {
        const aspectRatio = doptions.aspectratio;
        if (!aspectRatio || aspectRatio === '') {
            $videowrapper.css({
                width: '',
                height: '',
                maxWidth: '',
                maxHeight: '',
                margin: '',
                marginTop: doptions.kidtheme == 1 ? 5 : '',
            });
            return;
        }

        const [ratioW, ratioH] = aspectRatio.split(':').map(Number);
        const ratio = ratioW / ratioH;

        const controllerHeight = doptions.controlbar == 1 ? ($controlBar.outerHeight() || 55) : 0;
        const gap = $body.hasClass('embed-mode') ? 0 : 20;
        let availableHeight = window.innerHeight - controllerHeight - gap;
        if (doptions.distractionfreemode != 1) {
            availableHeight -= 40;
        }
        let availableWidth = $wrapper.width();

        if (!document.fullscreenElement) {
            const $navbar = $('.fixed-top, #nav-drawer'); // Moodle navbar.
            const navbarHeight = $navbar.length ? $navbar.outerHeight() : 0;
            availableHeight -= navbarHeight;
        } else {
            const fsMargin = 32; // Total margin (16px on each side).
            availableHeight = window.innerHeight - controllerHeight - fsMargin;
            availableWidth = window.innerWidth - fsMargin;
        }

        let newWidth = availableWidth;
        let newHeight = newWidth / ratio;

        if (newHeight > availableHeight) {
            newHeight = availableHeight;
            newWidth = newHeight * ratio;
        }

        const isFullscreen = !!document.fullscreenElement;
        $videowrapper.css({
            width: newWidth + 'px',
            height: newHeight + 'px',
            maxWidth: '100%',
            maxHeight: availableHeight + 'px',
            marginLeft: 'auto',
            marginRight: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: isFullscreen ? '1rem' : '',
            marginTop: isFullscreen ? '16px' : '',
            overflow: isFullscreen ? 'hidden' : '',
        });

        if (isFullscreen) {
            $controlBar.css({
                width: newWidth + 'px',
                marginLeft: 'auto',
                marginRight: 'auto',
            });
        } else {
            $controlBar.css({
                width: '',
                marginLeft: '',
                marginRight: '',
            });
        }
    };

    $videowrapper.toggleClass('d-none d-flex');

    // Remove all annotations that are not in the enabled content types.
    annotations = annotations.filter(x =>
        contentTypes.find(y => y.name === x.type)
    );

    // Order the annotations by sequence.
    annotations = sequence.map(x => annotations.find(y => y.id == x));
    annotations = annotations.filter(x => x); // Remove null values.
    const completedItems = safeParse(uprogress.completeditems, []);
    const completiondetails = safeParse(uprogress.completiondetails, {});
    annotations = annotations.map((x, i) => {
        x.order = i + 1;
        x.prop = JSON.stringify(contentTypes.find(y => y.name === x.type));
        x.completed = completedItems.includes(x.id);
        x.earned = 0;
        x.xp = Number(x.xp);
        const completionitem = completiondetails.find(
            c => safeParse(c, {}).id == x.id
        );
        if (completionitem) {
            let thisitem = safeParse(completionitem, {});
            x.earned = Number(thisitem.xp); // Earned from previous attempt.
            if (thisitem.percent) {
                // IV1.4.1 introduce percent to handle when teacher updates XP afterward.
                x.earned = x.xp * thisitem.percent;
            }
            if (x.earned % 1 !== 0) {
                x.earned = Math.round(x.earned * 100) / 100;
            }
            if (x.earned > x.xp) {
                // What if the teacher decreases the XP afterward?
                x.earned = x.xp;
            }
        } else {
            x.earned = 0;
        }
        return x;
    });

    state.annotations = annotations;

    // Update the sequence.
    state.sequence = annotations.map(x => x.id.toString());

    // Filter content types that are being used.
    contentTypes = contentTypes.filter(x =>
        annotations.find(y => y.type === x.name) || x.name === 'chapter'
    );

    if (contentTypes.length == 0) {
        $('#chaptertoggle, #chapter-container-left, #chapter-container-right').remove();
        return;
    } else {
        $('#chaptertoggle, #chapter-container-left, #chapter-container-right').removeClass('d-none');
    }

    if (doptions.openchapterpanel == 1 && window.innerWidth >= 1200 && !$body.hasClass('embed-mode')) {
        $('#interactivevideo-container').addClass('chapter-open');
        $('#chaptertoggle .btn i').removeClass('bi-collection').addClass('bi-collection-fill');
    }

    // Initialize the content type renderers for interactive video annotations.
    await Promise.all(
        contentTypes.map(contentType => {
            return new Promise(resolve => {
                if (!contentType.fbamdmodule) {
                    ctRenderer[contentType.name] = null;
                    resolve();
                    return;
                }
                require([contentType.fbamdmodule], function(Type) {
                    ctRenderer[contentType.name] = new Type(annotations, contentType);
                    resolve();
                });
            });
        })
    );

    if (window.ResizeObserver) {
        new ResizeObserver(() => {
            window.requestAnimationFrame(resizeVideoWrapper);
        }).observe($wrapper[0]);
    }
    $(window).on('resize', resizeVideoWrapper);

    // Run the init function on the content types.
    await Promise.all(
        contentTypes.map(async contentType => {
            if (!contentType.fbamdmodule) {
                return;
            }
            try {
                await ctRenderer[contentType.name].init();
            } catch (error) {
                window.console.error(error);
            }
        })
    );

    // Global tooltip dismissal on click.
    $(document).on('click', `[data${bsAffix}-toggle="tooltip"]`, function() {
        $(this).tooltip('hide');
    });

    /**
     * Get visible annotations based on completion status and advanced settings.
     * @param {Array} annos
     * @returns {Array}
     */
    const getVisibleAnnotations = (annos) => {
        if (state.config.iseditor) {
            return annos;
        }
        return annos.filter(x => {
            const advanced = safeParse(x.advanced, {});
            if (advanced.removeaftercompletion == 1 && x.completed == true) {
                // If it's the current one, we keep it visible until the user navigates away.
                if (state.currentanno && state.currentanno.id == x.id) {
                    return true;
                }
                return false;
            }
            if (advanced.removeafteractivitycompletion == 1 && state.config.isCompleted == true) {
                if (state.currentanno && state.currentanno.id == x.id) {
                    return true;
                }
                return false;
            }
            return true;
        });
    };

    const renderAnnotationItems = async annos => {
        annotations = annos;
        const visibleAnnos = getVisibleAnnotations(annos);

        // Hide existing tooltips before emptying the bar.
        $annotationbar.find(`[data${bsAffix}-toggle="tooltip"]`).tooltip('hide');

        $annotationbar.empty();
        if (visibleAnnos.length == 0) {
            return;
        }

        // Instagram style: max 5 items, current in middle.
        let displayAnnos = visibleAnnos;
        if (visibleAnnos.length > 5) {
            const currentIndex = state.currentanno
                ? visibleAnnos.findIndex(x => x.id == state.currentanno.id)
                : 0;
            let start = Math.max(0, currentIndex - 2);
            let end = Math.min(visibleAnnos.length - 1, start + 4);

            if (end - start < 4) {
                start = Math.max(0, end - 4);
            }
            displayAnnos = visibleAnnos.slice(start, end + 1);
        }

        if (state.currentanno && state.currentanno.id == 'endscreen') {
            // Get the last 5.
            displayAnnos = visibleAnnos.slice(-5);
        }

        // Make sure annotations are unique.
        const uniqueAnnos = visibleAnnos.filter((x, i) => visibleAnnos.findIndex(y => y.id == x.id) == i);

        // Map annotations with show key = true if it is in the displayAnnos.
        annotations = annotations.map(x => {
            x.show = displayAnnos.includes(x);
            return x;
        });

        await Promise.all(
            uniqueAnnos.map(async item => {
                try {
                    item.locked = ctRenderer[item.type].renderNavItem(
                        uniqueAnnos,
                        item,
                        $annotationbar
                    );
                } catch (error) {
                    item.locked = false;
                }
                return item;
            })
        );

        // Activate tooltips for the newly rendered items.
        $annotationbar.find(`[data${bsAffix}-toggle="tooltip"]`).tooltip({
            container: '#wrapper',
            boundary: 'window'
        });

        state.sequence = uniqueAnnos.map(x => x.id.toString());

        // Select the active one.
        if (state.currentanno) {
            $annotationbar
                .find(`.annotation-item[data-id='${state.currentanno.id}']`)
                .addClass('active');
        }

        // Update xpcounter in the control bar.
        let totalXp = annotations.reduce((sum, x) => sum + parseFloat(x.xp || 0), 0);
        let earnedXp = annotations.reduce((sum, x) => sum + parseFloat(x.earned || 0), 0);
        if (totalXp % 1 !== 0) {
            totalXp = Math.round(totalXp * 100) / 100;
        }
        if (earnedXp % 1 !== 0) {
            earnedXp = Math.round(earnedXp * 100) / 100;
        }
        $controlBar.find('#xpearned').text(earnedXp);
        $controlBar.find('#xptotal').text(totalXp);
        if (totalXp === 0) {
            $controlBar.find('#xpcounter').hide();
        } else {
            $controlBar.find('#xpcounter').show();
        }

        // Update the page counter.
        if (state.currentanno && state.currentanno.id != 'endscreen') {
            $controlBar
                .find('#thisanno')
                .text(state.currentanno.order);
        }
        $controlBar.find('#totalannos').text(annotations.length);

        dispatchEvent('annotationsrendered', {annotations});
    };

    // Render the annotations on the control bar.
    renderAnnotationItems(annotations);
    state.annotations = annotations;
    // Preload audio.
    const pop = new Audio(M.cfg.wwwroot + '/mod/interactivevideo/sounds/pop.mp3');
    const point = new Audio(
        M.cfg.wwwroot + '/mod/interactivevideo/sounds/point-awarded.mp3'
    );
    state.audio = {
        pop,
        point
    };

    const validateAnnotationAccess = async annotation => {
        // If it's the same annotation, always allow access (used for refreshing).
        if (state.currentanno && state.currentanno.id == annotation.id) {
            return true;
        }

        // Check if there are incomplete annotations with "preventskip" enabled before this annotation.
        const globalPreventskipping = doptions.preventskipping == 1;
        const incomplete = annotations.find(
            x =>
                x.hascompletion == 1 &&
                x.completed == false &&
                (globalPreventskipping || safeParse(x.advanced, {}).preventskip == 1) &&
                x.order < annotation.order
        );
        if (incomplete && !state.config.iseditor) {
            addToast(
                await getString('youmustcompletethisinteractionfirst', 'mod_flexbook'),
                {
                    type: 'default',
                    emoji: '🔐'
                }
            );
            if (incomplete.id != (state.currentanno ? state.currentanno.id : null)) {
                $annotationbar
                    .find(`.annotation-item[data-id='${incomplete.id}']`)
                    .trigger('click');
            }
            return false;
        }

        let advanced;
        if (state.currentanno && state.currentanno.id != 'endscreen') {
            state.currentanno = annotations.find(x => x.id == state.currentanno.id); // Update the currentanno with the latest data.
            // Check if this current annotation can be dismissed or skipped.
            advanced = safeParse(state.currentanno.advanced, {});
            if (
                (globalPreventskipping || advanced.preventskip == 1) &&
                !state.config.iseditor &&
                state.direction == 'next' &&
                state.currentanno.hascompletion == 1 &&
                state.currentanno.completed == false
            ) {
                addToast(
                    await getString(
                        'youmustcompletethisinteractionfirst',
                        'mod_flexbook'
                    ),
                    {
                        type: 'default',
                        emoji: '🔐'
                    }
                );
                return false;
            }

            // If interaction is locked till completed
            if (
                advanced.locked == 1 &&
                !state.config.iseditor &&
                state.currentanno.hascompletion == 1 &&
                state.currentanno.completed == false
            ) {
                addToast(
                    await getString(
                        'youmustcompletethisinteractionfirst',
                        'mod_flexbook'
                    ),
                    {
                        type: 'default',
                        emoji: '🔐'
                    }
                );
                return false;
            }
        }

        // UPCOMING FEATURE: Check if the annotation is accessible.
        let accessible = true;
        if (!accessible) {
            return false;
        }

        return true;
    };

    const animateOutCurrent = (annotation, force = false) => {
        const direction =
            annotation.order > (state.currentanno ? state.currentanno.order : 0)
                ? 'start'
                : 'end';
        const $activeMessage = $wrapper.find('#message[data-id].active');
        let current = annotations.find(x => x.id == state.currentanno?.id);

        if ($activeMessage.length) {
            const isSame = $activeMessage.attr('data-id') == annotation.id;
            if (isSame && force) {
                // If it is the same annotation and we're forcing a refresh, just remove it and animate in the new one.
                $activeMessage.remove();
                animateInNew(annotation, force);
                return;
            }

            dispatchEvent('interactionclose', {annotation: current});
            $activeMessage.addClass('slide-out-' + direction);

            // We're getting the currentanno again here in case the setTimeout function replaces the currentanno with the new one.
            setTimeout(() => {
                animateInNew(annotation, force);

                $activeMessage.removeClass('active show slide-out-start slide-out-end');
                let rerun = false;
                const advanced = safeParse(current.advanced, {});
                if (
                    advanced.rerunbeforecompleted == 1 &&
                    (current.hascompletion == 0 || current.completed == false)
                ) {
                    rerun = true;
                } else if (
                    advanced.rerunaftercompleted == 1 &&
                    current.hascompletion == 1 &&
                    current.completed == true
                ) {
                    rerun = true;
                }
                if (rerun) {
                    // Remove the current annotation.
                    $activeMessage.remove();
                }
            }, 500);
        } else {
            animateInNew(annotation, force);
        }
    };

    const animateInNew = async(annotation, force = false) => {
        const id = annotation.id;
        if (id == 'endscreen') {
            $('#end-screen').removeClass('d-none').addClass('active show');
            setTimeout(() => {
                $videowrapper.removeClass('bg-white');
            }, 1000);
            return;
        }
        const $existingMessage = $wrapper.find(`#message[data-id='${id}']`);
        if ($existingMessage.length) {
            if (force) {
                $existingMessage.remove();
            } else {
                // Show it.
                $existingMessage.addClass('active show');
                setTimeout(() => {
                    $videowrapper.removeClass('bg-white');
                }, 1000);
                return;
            }
        }
        await ctRenderer[annotation.type].runInteraction(annotation, $wrapper);
        state.direction = 'next';
        $wrapper.find(`#message[data-id='${id}']`).addClass('active show');
        setTimeout(() => {
            $videowrapper.removeClass('bg-white');
        }, 1000);
    };

    // eslint-disable-next-line complexity
    const navigateToInteraction = async(id, force = false, direction = 'next') => {
        if (!state.ready) {
            return;
        }

        // 1. Resolve special identifiers.
        let resolvedId = id;
        if (id === 'endscreen') {
            resolvedId = 'endscreen';
        } else if (id === 'firstpage') {
            resolvedId = state.sequence[0];
            direction = 'next';
        } else if (id === 'previousinteraction') {
            const index = state.currentanno ? state.sequence.indexOf(state.currentanno.id.toString()) : 0;
            resolvedId = index > 0 ? state.sequence[index - 1] : state.sequence[0];
            direction = 'prev';
        } else if (id === 'nextinteraction') {
            const index = state.currentanno ? state.sequence.indexOf(state.currentanno.id.toString()) : -1;
            resolvedId = (index < state.sequence.length - 1) ? state.sequence[index + 1] : 'endscreen';
            direction = 'next';
        }

        // 2. Normalize numeric ID.
        if (typeof resolvedId === 'string' && resolvedId.startsWith('@@ANNOID#')) {
            resolvedId = resolvedId.replace('@@ANNOID#', '');
        }

        // 3. Handle non-existent or hidden annotations with directional search.
        if (resolvedId != 'endscreen') {
            const visibleAnnos = getVisibleAnnotations(annotations);
            if (!visibleAnnos.find(x => x.id == resolvedId)) {
                // The target is either deleted or hidden. Find the next/prev available in sequence.
                const seqIndex = state.sequence.indexOf(resolvedId.toString());
                if (seqIndex !== -1) {
                    let foundId = null;
                    if (direction === 'next') {
                        for (let i = seqIndex; i < state.sequence.length; i++) {
                            if (visibleAnnos.find(x => x.id == state.sequence[i])) {
                                foundId = state.sequence[i];
                                break;
                            }
                        }
                        resolvedId = foundId || 'endscreen';
                    } else { // Prev
                        for (let i = seqIndex; i >= 0; i--) {
                            if (visibleAnnos.find(x => x.id == state.sequence[i])) {
                                foundId = state.sequence[i];
                                break;
                            }
                        }
                        resolvedId = foundId || state.sequence[0];
                    }
                } else {
                    // If ID is not in sequence at all, we can't do directional search.
                    // Just fallback to first available or endscreen.
                    resolvedId = visibleAnnos.length > 0 ? visibleAnnos[0].id : 'endscreen';
                }
            }
        }

        // 4. Actual navigation logic.
        if (resolvedId == 'endscreen') {
            if (state.currentanno && state.currentanno.id == 'endscreen') {
                return;
            }

            if (!(await validateAnnotationAccess({id: 'endscreen', order: annotations.length + 1}))) {
                return;
            }

            const url = new URL(window.location);
            if (url.searchParams.get('aid') != resolvedId) {
                url.searchParams.set('aid', resolvedId);
                window.history.pushState({aid: resolvedId}, '', url);
            }

            animateOutCurrent({id: 'endscreen', order: annotations.length + 1});

            state.currentanno = {id: 'endscreen', order: annotations.length + 1};
            await renderAnnotationItems(annotations);
            $videowrapper.addClass('bg-white');

            $controlBar.find('#thisanno').text(annotations.length);
            dispatchEvent('fb:ended');
            return;
        }

        // Hide endscreen if coming back from it.
        if (state.currentanno && state.currentanno.id == 'endscreen') {
            $('#end-screen').removeClass('active show').addClass('d-none');
        }

        if (state.currentanno && state.currentanno.id == resolvedId && !force) {
            return;
        }

        const annotation = annotations.find(x => x.id == resolvedId);
        if (!annotation) {
            return;
        }

        if (!(await validateAnnotationAccess(annotation))) {
            return;
        }

        // Now we're good to go.
        const url = new URL(window.location);
        if (url.searchParams.get('aid') != resolvedId) {
            url.searchParams.set('aid', resolvedId);
            window.history.pushState({aid: resolvedId}, '', url);
        }

        animateOutCurrent(annotation, force);

        state.currentanno = annotation;
        await renderAnnotationItems(annotations);
        $videowrapper.addClass('bg-white');

        $controlBar.find('#thisanno').text(annotation.order);

        dispatchEvent('interactionrun', {annotation: annotation});
    };

    const navigateToAnnotation = async(id, force = false) => {
        return navigateToInteraction(id, force);
    };

    state.navigateToInteraction = navigateToInteraction;
    state.navigateToAnnotation = navigateToAnnotation;

    $annotationbar.on('click', '.annotation-item', async function() {
        const id = $(this).data('id');
        await navigateToAnnotation(id);
    });

    const nextAnnotation = async() => {
        state.direction = 'next';
        if (state.nextAnno) { // This can be used by subplugins to control the next annotation.
            await navigateToAnnotation(state.nextAnno.id);
            delete state.nextAnno;
            return;
        }

        if (state.currentanno) {
            if (state.currentanno.id == 'endscreen') {
                return;
            }
            const advanced = safeParse(state.currentanno.advanced, {});
            if (!advanced.jumpto || advanced.jumpto == '') {
                await navigateToInteraction('nextinteraction', false, 'next');
            } else {
                await navigateToInteraction(advanced.jumpto, false, 'next');
            }
        }
    };

    const prevAnnotation = async() => {
        state.direction = 'prev';
        if (state.prevAnno) { // This can be used by subplugins to control the previous annotation.
            await navigateToAnnotation(state.prevAnno.id);
            delete state.prevAnno;
            return;
        }
        if (state.currentanno) {
            if (state.currentanno.id == 'endscreen') {
                window.history.back();
                return;
            }
            const advanced = safeParse(state.currentanno.advanced, {});
            if (!advanced.backto || advanced.backto == '') {
                await navigateToInteraction('previousinteraction', false, 'prev');
            } else if (advanced.backto == 'previouslyviewed') {
                window.history.back();
            } else {
                await navigateToInteraction(advanced.backto, false, 'prev');
            }
        }
    };

    $controlBar.on('click', '#nextanno', async function() {
        await nextAnnotation();
    });

    $controlBar.on('click', '#prevanno', async function() {
        await prevAnnotation();
    });

    // Handle the refresh button:: allowing user to refresh the content
    $wrapper.on('click', '#message #refresh', function(e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        $(this).tooltip('hide');
        const id = $(this).data('id');
        const annotation = annotations.find(x => x.id == id);
        $(this).find('i').addClass('fa-spin');
        const thisbutton = $(this);
        setTimeout(function() {
            state.currentanno = null;
            thisbutton.closest('#message').remove();
            const renderer = state.ctRenderer[annotation?.type];
            if (renderer?.cache) {
                delete renderer.cache[annotation.id];
            }
            dispatchEvent('interactionrefresh', {annotation: annotation});
            navigateToAnnotation(id, true);
        }, 1000);
    });

    // Resume and start button.
    $(document).on('click', '#play', async function(e) {
        e.preventDefault();

        if (annotations.length === 0) {
            addToast(await getString('nointeractionsfound', 'mod_flexbook'), {
                type: 'info',
                emoji: '📄'
            });
            return;
        }

        // Auto fullscreen on mobile.
        if (
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
                navigator.userAgent
            ) ||
            $body.hasClass('mobileapp') ||
            navigator.userAgent.includes('MoodleMobile')
        ) {
            toggleFullscreen();
        }

        const url = new URL(window.location);
        const aid = url.searchParams.get('aid');
        let annotation = annotations.find(x => x.order == 1) || annotations[0];
        if (aid && aid != 'endscreen' && aid != '0') {
            const found = annotations.find(x => x.id == aid);
            if (found) {
                annotation = found;
            }
        } else if (uprogress.lastviewed && uprogress.lastviewed != 'endscreen' && uprogress.lastviewed != '0') {
            // Resume from last viewed annotation if no aid in URL.
            const found = annotations.find(x => x.id == uprogress.lastviewed);
            if (found) {
                annotation = found;
            }
        }
        $startscreen.addClass('slide-out-start active');
        $controlBar.removeClass('no-pointer-events');
        dispatchEvent('fb:started');
        state.ready = true;
        await navigateToAnnotation(annotation.id);
    });

    // Restart button.
    $(document).on('click', '#restart', async function(e) {
        e.preventDefault();
        dispatchEvent('fb:restarted');
        const first = annotations.find(x => x.order == 1) || annotations[0];
        await navigateToAnnotation(first.id);
    });

    // Share button.
    $(document).on('click', '#share', async function(e) {
        e.preventDefault();
        const url = window.location.href;
        try {
            await navigator.clipboard.writeText(url);
            addToast(await getString('copiedtoclipboard', 'mod_interactivevideo'), {
                type: 'default',
                emoji: '🔗'
            });
        } catch (err) {
            addToast('Link copied to clipboard', {type: 'default', emoji: '🔗'});
        }
    });

    // Handle browser back/forward buttons.
    window.addEventListener('popstate', async() => {
        if (!state.ready) {
            return; // Start screen hasn't been dismissed yet.
        }
        const url = new URL(window.location);
        const aid = url.searchParams.get('aid');
        if (aid) {
            await navigateToAnnotation(aid);
        } else if (annotations.length > 0) {
            await navigateToAnnotation(annotations[0].id);
        }
    });

    // Listen for fullscreen change to update icons and classes.
    document.addEventListener('fullscreenchange', () => {
        const icon = $('#fullscreen i');
        if (document.fullscreenElement) {
            icon.removeClass('bi-fullscreen').addClass('bi-fullscreen-exit');
            $wrapper.addClass('fullscreen');
        } else {
            icon.removeClass('bi-fullscreen-exit').addClass('bi-fullscreen');
            $wrapper.removeClass('fullscreen');
        }
        resizeVideoWrapper();
    });

    $(document).on('click', '#fullscreen', function(e) {
        e.preventDefault();
        toggleFullscreen();
    });

    // Delete progress.
    $(document).on('click', '#deleteprogress', async function(e) {
        e.preventDefault();
        const deleteProgress = () => {
            Ajax.call([{
                methodname: 'mod_flexbook_delete_progress',
                args: {
                    contextid: M.cfg.contextid,
                    recordids: state.config.completionid.toString(),
                    courseid: state.config.courseid,
                    cmid: state.config.cmid
                }
            // eslint-disable-next-line promise/always-return
            }])[0].then(() => {
                window.location.reload();
            }).catch(error => window.console.error(error));
        };

        const [title, question, deleteStr] = await getStrings([
            {key: 'deletecompletion', component: 'mod_flexbook'},
            {key: 'deletecompletiondesc', component: 'mod_flexbook'},
            {key: 'delete', component: 'core'}
        ]);

        try {
            Notification.deleteCancelPromise(title, question, deleteStr)
                // eslint-disable-next-line promise/always-return
                .then(() => {
                    deleteProgress();
                })
                .catch(() => {
                    // Cancelled.
                });
        } catch (error) {
            Notification.saveCancel(title, question, deleteStr, deleteProgress);
        }
    });

    $(document).on('click', '#delete-completiondata', async function(e) {
        e.preventDefault();
        const id = $(this).attr('data-id');

        const deleteCompletionData = async() => {
            const annotation = annotations.find(x => x.id == id);
            ctRenderer[annotation.type].deleteProgress(annotation);
        };

        const [title, question, deleteStr] = await getStrings([
            {key: 'deletethiscompletion', component: 'mod_interactivevideo'},
            {key: 'deletethiscompletiondesc', component: 'mod_interactivevideo'},
            {key: 'delete', component: 'mod_interactivevideo'},
        ]);
        try {
            Notification.deleteCancelPromise(title, question, deleteStr)
                .then(deleteCompletionData)
                .catch(() => {
                    // Cancelled.
                });
        } catch (error) {
            Notification.saveCancel(title, question, deleteStr, deleteCompletionData);
        }
    });

    // Update UI on completion.
    $(document).on('requireuiupdate', function(e) {
        annotations = e.originalEvent.detail.annotations;
        renderAnnotationItems(annotations);
    });

    $(document).on('fb:refresh_interaction', async function(e) {
        const id = e.originalEvent.detail.id;
        await navigateToAnnotation(id, true);
    });

    // Implement keyboard shortcuts.
    document.addEventListener('keydown', async function(e) {
        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                await prevAnnotation();
                break;
            case 'ArrowRight':
                e.preventDefault();
                await nextAnnotation();
                break;
            case 's':
            case 'S':
                if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) || e.altKey || e.ctrlKey || e.metaKey) {
                    return;
                }
                e.preventDefault();
                $('#share').trigger('click');
                break;
            case 'f':
            case 'F':
                if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) || e.altKey || e.ctrlKey || e.metaKey) {
                    return;
                }
                e.preventDefault();
                toggleFullscreen();
                break;
            case 'c':
            case 'C':
                if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) || e.altKey || e.ctrlKey || e.metaKey) {
                    return;
                }
                e.preventDefault();
                $('#chaptertoggle .btn').trigger('click');
                break;
        }
    });

    // Swipe left/right to navigate between annotations (touch devices).

    // Mimics #nextanno (swipe left) and #prevanno (swipe right) clicks.
    (() => {
        // Minimum horizontal distance (px) to register as a swipe.
        const SWIPE_THRESHOLD = 50;
        // Maximum vertical drift (px) allowed — keeps accidental scroll-swipes from triggering.
        const VERTICAL_LIMIT = 75;
        // Minimum swipe speed (px/ms) — filters out slow deliberate drags on scrollable content.
        const MIN_VELOCITY = 0.3;

        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartTime = 0;
        let swipeLocked = false; // True when the touch started inside a no-swipe zone.

        /**
         * Returns true if the element (or any ancestor up to $videowrapper) is a
         * surface that has its own horizontal scrolling or is an interactive embed
         * where a horizontal drag has a different meaning (PDF viewer, iframe, etc.).
         *
         * @param {EventTarget} target - The element where the touch started.
         * @returns {boolean}
         */
        const isNoSwipeTarget = target => {
            const noSwipeSelectors = [
                'iframe', // PDF viewer, embedded content.
                '[contenteditable]',
                'input',
                'textarea',
                'select',
                '.no-swipe', // Opt-out class for custom widgets.
                '.fabric-canvas', // Fabric.js annotation canvas.
                '[data-no-swipe]'
            ];
            let el = target;
            while (el && el !== $videowrapper[0]) {
                // Block swipe if the element itself scrolls horizontally.
                if (el.scrollWidth > el.clientWidth + 2) {
                    return true;
                }
                for (const sel of noSwipeSelectors) {
                    if (el.matches && el.matches(sel)) {
                        return true;
                    }
                }
                el = el.parentElement;
            }
            return false;
        };

        $videowrapper[0].addEventListener(
            'touchstart',
            function(e) {
                const touch = e.touches[0];
                touchStartX = touch.clientX;
                touchStartY = touch.clientY;
                touchStartTime = Date.now();
                swipeLocked = isNoSwipeTarget(e.target);
            },
            {passive: true}
        );

        $videowrapper[0].addEventListener(
            'touchend',
            function(e) {
                if (swipeLocked) {
                    return;
                }
                const touch = e.changedTouches[0];
                const dx = touch.clientX - touchStartX;
                const dy = touch.clientY - touchStartY;
                const dt = Date.now() - touchStartTime || 1; // Avoid division by zero.
                const velocity = Math.abs(dx) / dt;

                // Reject if predominantly vertical, too short, or too slow.
                if (Math.abs(dy) > VERTICAL_LIMIT) {
                    return;
                }
                if (Math.abs(dx) < SWIPE_THRESHOLD) {
                    return;
                }
                if (velocity < MIN_VELOCITY) {
                    return;
                }

                if (dx < 0) {
                    // Swiped left → go to next annotation.
                    nextAnnotation();
                } else {
                    // Swiped right → go to previous annotation.
                    prevAnnotation();
                }
            },
            {passive: true}
        );
    })();


    // Automatically resume if 'aid' is in the URL.
    const url = new URL(window.location);
    const aid = url.searchParams.get('aid');
    if (aid) {
        if (annotations.find(x => x.id == aid) || aid == 'endscreen') {
            $('#play').trigger('click');
        } else {
            // Invalid aid, notify user and clean up URL.
            url.searchParams.delete('aid');
            window.history.replaceState({}, '', url);

            addToast(await getString('annotationnotfound', 'mod_flexbook'), {type: 'warning', emoji: '🔍'});
        }
    }
};

export default {
    /**
     * Initialize function on page loads.
     * @param {Object} config The configuration object
     */
    init: init
};
