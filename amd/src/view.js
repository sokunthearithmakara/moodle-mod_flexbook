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
        isPreviewMode: false
    };

    // Initialize interaction tracking data from saved progress (resumable).
    const interactionData = safeParse(uprogress.details, {timespent: {}, views: {}});
    if (!interactionData.timespent) {
        interactionData.timespent = {};
    }
    if (!interactionData.views) {
        interactionData.views = {};
    }
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
        const saved = (interactionData.timespent && interactionData.timespent[id]) || 0;
        const live = (trackingAnnotationId == id && interactionStartTime !== null)
            ? Date.now() - interactionStartTime
            : 0;
        return saved + live;
    };

    const pauseInteractionTimer = () => {
        // Flush elapsed time into the total, but keep trackingAnnotationId so we can resume.
        if (trackingAnnotationId !== null && interactionStartTime !== null) {
            const elapsed = Date.now() - interactionStartTime;
            interactionData.timespent[trackingAnnotationId] =
                (interactionData.timespent[trackingAnnotationId] || 0) + elapsed;
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

    $(document).on('interactionrun', function(e) {
        stopInteractionTimer(); // Flush any previously running timer.
        const id = e.detail.annotation.id;
        interactionData.views[id] = (interactionData.views[id] || 0) + 1;
        trackingAnnotationId = id;
        interactionStartTime = Date.now();
        state.interactionData = interactionData;
    });

    $(document).on('interactionclose interactionrefresh', function() {
        stopInteractionTimer();
    });

    $(document).on('fb:ended', function() {
        if (!uprogress.timeended && !state.reachendSent) {
            saveInteractionData(true);
            state.reachendSent = true;
        } else {
            saveInteractionData(false);
        }
    });

    const saveInteractionData = (reachend = false) => {
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
                return data;
            }).catch(e => window.console.error(e));
        } else {
            const url = `${M.cfg.wwwroot}/lib/ajax/service.php?sesskey=${M.cfg.sesskey}`;
            const body = JSON.stringify([{index: 0, methodname: 'mod_flexbook_save_interaction_data', args}]);
            navigator.sendBeacon(url, new Blob([body], {type: 'application/json'}));
        }
    };

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            saveInteractionData();
        } else if (document.visibilityState === 'visible') {
            resumeInteractionTimer();
        }
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
            });
            return;
        }

        const [ratioW, ratioH] = aspectRatio.split(':').map(Number);
        const ratio = ratioW / ratioH;

        const controllerHeight = doptions.controlbar == 1 ? ($controlBar.outerHeight() || 55) : 0;
        const gap = 20;
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
            availableHeight = window.innerHeight - controllerHeight;
            availableWidth = window.innerWidth;
        }

        let newWidth = availableWidth;
        let newHeight = newWidth / ratio;

        if (newHeight > availableHeight) {
            newHeight = availableHeight;
            newWidth = newHeight * ratio;
        }

        $videowrapper.css({
            width: newWidth + 'px',
            height: newHeight + 'px',
            maxWidth: '100%',
            maxHeight: availableHeight + 'px',
            marginLeft: 'auto',
            marginRight: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        });
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

    resizeVideoWrapper();
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

        if (state.currentanno && state.currentanno.id == 999) {
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
        const totalXp = annotations.reduce((sum, x) => sum + (x.xp || 0), 0);
        const earnedXp = annotations.reduce((sum, x) => sum + (x.earned || 0), 0);
        $controlBar.find('#xpearned').text(earnedXp);
        $controlBar.find('#xptotal').text(totalXp);
        if (totalXp === 0) {
            $controlBar.find('#xpcounter').hide();
        } else {
            $controlBar.find('#xpcounter').show();
        }

        // Update the page counter.
        if (state.currentanno && state.currentanno.id != 999) {
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
        if (state.currentanno && state.currentanno.id != 999) {
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

    const animateInNew = async (annotation, force = false) => {
        const id = annotation.id;
        if (id == 999) {
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

    const navigateToAnnotation = async (id, force = false) => {
        if (id == 999) {
            if (state.currentanno && state.currentanno.id == 999) {
                return;
            }

            if (!(await validateAnnotationAccess({id: 999, order: annotations.length + 1}))) {
                return;
            }

            const url = new URL(window.location);
            if (url.searchParams.get('aid') != id) {
                url.searchParams.set('aid', id);
                window.history.pushState({aid: id}, '', url);
            }

            animateOutCurrent({id: 999, order: annotations.length + 1});

            state.currentanno = {id: 999, order: annotations.length + 1};
            await renderAnnotationItems(annotations);
            $videowrapper.addClass('bg-white');

            $controlBar.find('#thisanno').text(annotations.length);
            dispatchEvent('fb:ended');
            return;
        }

        // Hide endscreen if coming back from it.
        if (state.currentanno && state.currentanno.id == 999) {
            $('#end-screen').removeClass('active show').addClass('d-none');
        }

        if (state.currentanno && state.currentanno.id == id && !force) {
            return;
        }

        if (id != 999) {
            const visible = getVisibleAnnotations(annotations);
            if (!visible.find(x => x.id == id)) {
                // Skip to next visible.
                const fullIndex = annotations.findIndex(x => x.id == id);
                const nextVisible = annotations.slice(fullIndex + 1).find(x => visible.includes(x));
                return navigateToAnnotation(nextVisible ? nextVisible.id : 999);
            }
        }

        const annotation = annotations.find(x => x.id == id);

        if (!(await validateAnnotationAccess(annotation))) {
            return;
        }

        // Now we're good to go.
        const url = new URL(window.location);
        if (url.searchParams.get('aid') != id) {
            url.searchParams.set('aid', id);
            window.history.pushState({aid: id}, '', url);
        }

        // Let's first handle the active message if exists. 2 things: slide it out and decide whether to remove it.
        animateOutCurrent(annotation, force);

        state.currentanno = annotation;
        await renderAnnotationItems(annotations);
        $videowrapper.addClass('bg-white');

        $controlBar.find('#thisanno').text(annotation.order);

        dispatchEvent('interactionrun', {annotation: annotation});
    };

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
            if (state.currentanno.id == 999) {
                return;
            }
            const index = state.sequence.indexOf(state.currentanno.id.toString());
            const advanced = safeParse(state.currentanno.advanced, {});
            if (!advanced.jumpto || advanced.jumpto == '') {
                const nextid = state.sequence[index + 1];
                if (nextid) {
                    await navigateToAnnotation(nextid);
                } else {
                    // Show endscreen if text is available.
                    await navigateToAnnotation(999);
                }
            } else if (advanced.jumpto == 'endscreen' || advanced.jumpto == '999') {
                await navigateToAnnotation(999);
            } else {
                await navigateToAnnotation(advanced.jumpto);
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
            if (state.currentanno.id == 999) {
                window.history.back();
                return;
            }
            const index = state.sequence.indexOf(state.currentanno.id.toString());
            const advanced = safeParse(state.currentanno.advanced, {});
            if (!advanced.backto || advanced.backto == '') {
                const backto = state.sequence[index - 1];
                if (backto) {
                    await navigateToAnnotation(backto);
                }
            } else if (advanced.backto == 'endscreen' || advanced.backto == '999') {
                await navigateToAnnotation(999);
            } else {
                await navigateToAnnotation(advanced.backto);
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
            dispatchEvent('interactionrefresh', {annotation: annotation});
            navigateToAnnotation(id);
        }, 1000);
    });

    // Resume and start button.
    $(document).on('click', '#play', async function(e) {
        e.preventDefault();

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
        if (aid && aid != '999') {
            const found = annotations.find(x => x.id == aid);
            if (found) {
                annotation = found;
            }
        } else if (uprogress.lastviewed && uprogress.lastviewed != '999') {
            // Resume from last viewed annotation if no aid in URL.
            const found = annotations.find(x => x.id == uprogress.lastviewed);
            if (found) {
                annotation = found;
            }
        }
        $startscreen.addClass('slide-out-start active');
        $controlBar.removeClass('no-pointer-events');
        dispatchEvent('fb:started');
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
        if (!state.currentanno) {
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
        // Control + arrow keys.
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    await prevAnnotation();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    await nextAnnotation();
                    break;
            }
        } else {
            switch (e.key) {
                case 's':
                case 'S':
                    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
                        return;
                    }
                    e.preventDefault();
                    $('#share').trigger('click');
                    break;
                case 'f':
                case 'F':
                    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
                        return;
                    }
                    e.preventDefault();
                    toggleFullscreen();
                    break;
                case 'c':
                case 'C':
                    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
                        return;
                    }
                    e.preventDefault();
                    $('#chaptertoggle .btn').trigger('click');
                    break;
            }
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
        if (annotations.find(x => x.id == aid) || aid == 999) {
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
