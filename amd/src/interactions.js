/* eslint-disable max-depth */
/* eslint-disable complexity */
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
 * Module interactions
 *
 * @module     mod_flexbook/interactions
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import $ from 'jquery';
import {add as addToast} from 'core/toast';
import {get_string as getString} from 'core/str';
import Notification from 'core/notification';
import {dispatchEvent} from 'core/event_dispatcher';
import ModalEvents from 'core/modal_events';
import 'mod_interactivevideo/libraries/jquery-ui';
import Ajax from 'core/ajax';
import {safeParse, getMoodleVersion} from './utils';
import {isGlobalInteraction, sortForEditList, enforceGlobalPrefixInDom} from './interaction-utils';
import state from './state';
import {init as initInstructions} from './instructions';

const addNotification = (msg, type = "info") => {
    addToast(msg, {
        type: type
    });
};

// localStorage key for cross-activity interaction copy/paste.
const CLIPBOARD_KEY = 'copiedFlexbookItems';

const init = async(
    cmid,
    flexbook,
    courseid,
    coursecontextid,
    userid,
    extendedcompletion = null,
    contextid = 0,
    uploadrepoid = 0,
) => {

    let doptions = safeParse($('#doptions').val() || $('#doptions').text(), {});
    let contentTypes = safeParse($('#contenttypes').val() || $('#contenttypes').text(), {});
    let annotations = safeParse($('#items').val() || $('#items').text(), []);

    state.config = {
        cmid,
        flexbook,
        courseid,
        coursecontextid,
        contextid: contextid || coursecontextid,
        uploadrepoid,
        userid,
        extendedcompletion,
        isEditMode: true,
        darkmode: doptions.darkmode == 1
    };

    const uploadStrings = {
        serverconnection: await getString('serverconnection', 'error'),
        norepository: await getString('erroruploadnorepository', 'mod_flexbook'),
        uploadlimit: 'The file exceeds the server upload limit.',
        createfailed: await getString('errorcreatinginteraction', 'mod_flexbook'),
    };

    require(['theme_boost/bootstrap/modal']);

    // Preload audio.
    const pop = new Audio(M.cfg.wwwroot + '/mod/interactivevideo/sounds/pop.mp3');
    const point = new Audio(
        M.cfg.wwwroot + '/mod/interactivevideo/sounds/point-awarded.mp3'
    );
    state.audio = {
        pop,
        point
    };

    // DOM elements.
    const $annotationlist = $('#annotation-list');
    const $listitem = $('#annotation-template').clone();
    $('#annotation-template').remove();
    const $moreactionsmenu = $('.more-actions-menu');
    const $loader = $('#video-wrapper #background-loading');
    let sequence = $('#sequence').text().split(',');

    let ctRenderer = {};
    state.ctRenderer = ctRenderer;
    state.annotations = annotations;

    initInstructions();

    // Remove all annotations that are not in the enabled content types.
    annotations = annotations.filter(x => contentTypes.find(y => y.name === x.type));

    if (annotations.length == 0) {
        let html = `<button class="btn btn-rounded btn-primary btn-sm text-uppercase px-3" id="addinteractionbtn">
            <i class="bi bi-plus-lg text-white iv-mr-2 p-0" aria-hidden="true"></i> `;
            html += await getString('add', 'mod_interactivevideo');
            html += '</button>';
        $annotationlist.html(html)
            .addClass("d-flex align-items-center justify-content-center");
    }

    // Order the annotations by sequence, then pin global interactions to the top.
    annotations = sequence.map(x => annotations.find(y => y.id == x));
    annotations = annotations.filter(x => x); // Remove null values.
    annotations = sortForEditList(annotations, sequence);

    annotations = annotations.map(x => {
        x.prop = JSON.stringify(contentTypes.find(y => y.name === x.type));
        return x;
    });

    let activeid = null; // Current active annotation id. Mainly used when editing to relaunch the interaction afte editing.
    let previewRenderToken = 0;
    const url = new URL(window.location);
    let aid = url.searchParams.get('aid');
    if (aid) {
        activeid = aid;
        url.searchParams.delete('aid');
        window.history.replaceState({}, '', url);
    }

    /**
     * Renders a preview of the interaction in the main stage area.
     * @param {Object} annotation
     */
    const previewInStage = async(annotation) => {
        if (!annotation) {
            return;
        }
        const renderToken = ++previewRenderToken;
        $loader.stop(true, true).fadeIn(300);
        if (activeid && String(activeid) !== String(annotation.id)) {
            const previous = annotations.find((item) => String(item.id) === String(activeid));
            if (previous) {
                dispatchEvent('interactionclose', {annotation: previous});
            }
        }
        activeid = annotation.id;

        const $stage = $('#editor-stage');
        const $canvas = $('#annotation-canvas');

        // Clear canvas and existing messages
        $canvas.empty();
        $stage.find('#message').remove();
        $('#navigationtoolbar').empty();

        // Run interaction inline
        try {
            await ctRenderer[annotation.type].runInteraction(annotation, $stage);
            dispatchEvent('interactionrun', {annotation});

            // Fix: Bootstrap modals need 'show' class to be visible.
            // Also adding 'active' for consistency with player logic.
            $stage.find(`#message[data-id="${annotation.id}"]`).addClass('active show');

            // Highlight active item in sidebar
            $annotationlist.find('tr').removeClass('active-preview');
            $annotationlist.find(`tr[data-id="${annotation.id}"]`).addClass('active-preview');

            // Update control bar
            updateControlBar(annotation);

            // Resize stage
            resizePreview();

            // Update FAB
            const $fab = $('#editor-edit-btn');
            $fab.removeClass('d-none').data('id', annotation.id).data('type', annotation.type);
        } catch (e) {
            window.console.error("Preview failed:", e, annotation);
        } finally {
            if (renderToken === previewRenderToken) {
                $loader.stop(true, true).fadeOut(300);
            }
        }
    };

    /**
     * Resizes the preview stage to respect the aspect ratio.
     * Uses #editor-stage-main as the reference container.
     */
    const resizePreview = () => {
        const $main = $('#editor-stage-main');
        const $videoWrapper = $('#video-wrapper');

        if (!$main.length || !$videoWrapper.length) {
            return;
        }

        // Stage metrics from the dedicated main wrapper
        const availableWidth = $main.width();
        const availableHeight = $main.height();

        if (availableWidth <= 0 || availableHeight <= 0) {
            return;
        }

        // Get the aspect ratio from display options
        const aspectRatio = (doptions && doptions.aspectratio) ? doptions.aspectratio : null;

        if (!aspectRatio) {
            const limited = !doptions || doptions.limitedwidth != 0;
            $videoWrapper.css({
                width: 'calc(100% - 20px)',
                maxWidth: limited ? '1250px' : 'unset',
                height: Math.floor(availableHeight - 20) + 'px',
                maxHeight: '100%'
            });
            return;
        }

        const [ratioW, ratioH] = aspectRatio.split(':').map(Number);
        const ratio = (ratioW && ratioH) ? (ratioW / ratioH) : null;

        if (!ratio) {
            const limited = !doptions || doptions.limitedwidth != 0;
            $videoWrapper.css({
                width: 'calc(100% - 20px)',
                maxWidth: limited ? '1250px' : 'unset',
                height: Math.floor(availableHeight - 20) + 'px',
                maxHeight: '100%'
            });
            return;
        }

        // Provide a small gap for aesthetics
        const gap = 20;
        const boundedWidth = availableWidth - gap;
        const boundedHeight = availableHeight - gap;

        let newWidth = boundedWidth;
        let newHeight = newWidth / ratio;

        if (newHeight > boundedHeight) {
            newHeight = boundedHeight;
            newWidth = newHeight * ratio;
        }

        $videoWrapper.css({
            width: Math.floor(newWidth) + 'px',
            height: Math.floor(newHeight) + 'px',
            maxWidth: '100%',
            maxHeight: '100%',
            marginLeft: 'auto',
            marginRight: 'auto'
        });
    };

    /**
     * Updates the simplified control bar in the editor.
     * @param {Object} current
     */
    const updateControlBar = (current) => {
        const countableAnnos = annotations.filter(item => {
            if (item.type === 'chapter') {
                return false;
            }
            const renderer = state.ctRenderer[item.type];
            if (!renderer || typeof renderer.isVisible !== 'function') {
                return true;
            }
            return renderer.isVisible(item);
        });
        const total = countableAnnos.length;
        const index = countableAnnos.findIndex(a => String(a.id) === String(current.id));
        const currentNum = index >= 0 ? index + 1 : 0;
        const $counter = $('#currentanno');
        if (total === 0 || currentNum === 0) {
            $counter.addClass('d-none');
        } else {
            $counter.removeClass('d-none');
            $('#thisanno').text(currentNum);
            $('#totalannos').text(total);
        }

        // XP
        let totalXp = annotations.reduce((acc, a) => acc + (Number(a.xp) || 0), 0);
        if (totalXp % 1 !== 0) {
            totalXp = Math.round(totalXp * 100) / 100;
        }
        $('#xptotal').text(totalXp);
        // Current interaction XP
        $('#xpearned').text(Number(current.xp) || 0);
    };

    const initResizableSidebar = () => {
        const $sidebar = $('#editor-sidebar');
        const $handle = $('#sidebar-resize-handle');
        const storageKey = `mod_flexbook_sidebar_width_${cmid}`;
        const minWidth = 320;
        const maxWidth = () => Math.max(minWidth, Math.floor($(window).width() * 0.75));
        const applyWidth = (width) => {
            const nextWidth = Math.min(maxWidth(), Math.max(minWidth, Math.floor(width)));
            $sidebar.css({
                width: nextWidth + 'px',
                minWidth: nextWidth + 'px',
            });
            return nextWidth;
        };
        const savedWidth = parseInt(window.localStorage.getItem(storageKey), 10);
        if (savedWidth > 0 && $(window).width() >= 992) {
            applyWidth(savedWidth);
        }
        $handle.off('mousedown.flexbookresize').on('mousedown.flexbookresize', (e) => {
            if ($sidebar.hasClass('collapsed') || $(window).width() < 992) {
                return;
            }
            e.preventDefault();
            const startX = e.pageX;
            const startWidth = $sidebar.outerWidth();
            $sidebar.addClass('resizing');
            $('body').addClass('sidebar-resizing');
            $(document).off('.flexbookresize')
                .on('mousemove.flexbookresize', (moveEvent) => {
                    const newWidth = applyWidth(startWidth + startX - moveEvent.pageX);
                    window.localStorage.setItem(storageKey, newWidth);
                    resizePreview();
                })
                .on('mouseup.flexbookresize', () => {
                    $sidebar.removeClass('resizing');
                    $('body').removeClass('sidebar-resizing');
                    $(document).off('.flexbookresize');
                    resizePreview();
                });
        });
    };

    /**
     * Handle rendering of annotation items on the list
     * @param {Array} annotations array of annotation objects
     * @param {Boolean} refreshPreview Whether to force a preview refresh
     * @param {Boolean} nopreview Whether to skip previewing
     * @returns
     */
    const renderAnnotationItems = async(annotations, refreshPreview = false, nopreview = false) => {
        state.annotations = annotations;
        $('#annotationwrapper .loader').remove();
        $annotationlist.empty().removeClass("d-flex align-items-center justify-content-center");
        if (annotations.length == 0) {
            let html = `<button class="btn btn-rounded btn-primary btn-sm text-uppercase px-3" id="addinteractionbtn">
            <i class="bi bi-plus-lg text-white iv-mr-2 p-0" aria-hidden="true"></i> `;
            html += await getString('add', 'mod_interactivevideo');
            html += '</button>';
            $annotationlist.html(html)
                .addClass("d-flex align-items-center justify-content-center");
            return;
        }

        annotations.forEach(function(item) {
            let listItem = $listitem.clone();
            try {
                ctRenderer[item.type].renderEditItem(annotations, listItem, item);
                $annotationlist.append(listItem);
            } catch (e) {
                window.console.error(e, item);
            }
        });

        // Interactions of a content type that is not activated stay listed, so a teacher can see
        // their content is intact, but everything that edits them is switched off. The server
        // refuses these writes as well; this only removes the affordance.
        const inactiveTypes = (contentTypes || []).filter(x => x.inactive).map(x => x.name);
        if (inactiveTypes.length > 0) {
            const notice = await getString('contenttypenotusable', 'mod_interactivevideo');
            inactiveTypes.forEach(function(type) {
                const $rows = $annotationlist.find(`[data-type="${type}"]`);
                $rows.addClass('iv-type-inactive');
                // Inline editing is driven off data-editable, so dropping it disables it.
                $rows.find('[data-editable]').removeAttr('data-editable');
                $rows.find('.copy, .edit').prop('disabled', true).addClass('disabled');
                $rows.find('.type-icon').attr('title', notice);
            });
        }

        let xp = annotations.filter(x => x.xp).map(x => Number(x.xp)).reduce((a, b) => a + b, 0);
        $("#xp span").text(xp);
        if (nopreview) {
            $('#annotation-canvas').append(`<div class="text-center mt-5" id="clicktopreview">
                <i class="bi bi-cursor" aria-hidden="true"></i>
                <h5>${await getString('clicktheinteractiontopreview', 'mod_flexbook')}</h5></div>`);
            return;
        }
        if (activeid) {
            const activeAnno = annotations.find(x => x.id == activeid);
            if (activeAnno) {
                $('#clicktopreview').remove();
                if (refreshPreview) {
                    await previewInStage(activeAnno);
                } else {
                    // Just update UI highlights and control bar state
                    $annotationlist.find('tr').removeClass('active-preview');
                    $annotationlist.find(`tr[data-id="${activeAnno.id}"]`).addClass('active-preview');
                    updateControlBar(activeAnno);
                }
            }
        } else if (annotations.length > 0 && refreshPreview) {
            // Preview the first one if nothing is active and we want to refresh (e.g. initial load)
            await previewInStage(annotations[0]);
        }

        if (aid) {
            // Open the edit form.
            const type = annotations.find(a => a.id == aid)?.type;
            if (type && ctRenderer[type]) {
                ctRenderer[type].linkedEdit(annotations, aid);
            }
            // Clear the aid so it's not re-opened on next render
            aid = null;
        }
    };

    // Sortable. Note that if the sorting item is b-active, we're moving all the b-active items.
    // Global interactions are excluded: they cannot be dragged and are always pinned to the top.
    $('#annotation-list').sortable({
        handle: '.handle',
        cursor: 'move',
        items: '.listItem:not(.global-interaction)',
        placeholder: "ui-state-highlight",
        start: function(e, ui) {
            if (ui.item.hasClass('b-active')) {
                // Hide sibling selected rows immediately so only the combined
                // helper is visible — gives a smooth "moving all rows" feel.
                // Global rows are never moved, so keep them visible and in place.
                ui.item.siblings('tr.b-active').not('.global-interaction').css({opacity: '0', pointerEvents: 'none'});
            }
        },
        stop: function() {
            // Restore visibility whether the order changed or not.
            $annotationlist.find('tr').css({opacity: '', pointerEvents: ''});
            // Dismiss the bulk toolbar if no rows remain selected after the drag.
            syncBulkToolbar();
        },
        update: function(e, ui) {
            $('#savedraft').prop('disabled', false);
            const item = ui.item;
            if (item.hasClass('b-active')) { // If the item is b-active, we're moving all the b-active items.
                // Only move non-global selected rows; globals stay pinned at the top.
                const selecteditems = item.parent().find('tr.b-active').not('.global-interaction');
                selecteditems.each(function() {
                    const $item = $(this);
                    $item.removeClass('b-active moving');
                    $item.insertAfter(item);
                });
                selecteditems.addClass('active');
                setTimeout(function() {
                    selecteditems.removeClass('active');
                }, 1000);
            }
            // Ensure globals remain at the top regardless of where the drag landed.
            enforceGlobalPrefixInDom($annotationlist);
            // Sync the annotations array to the new DOM order so that a
            // subsequent renderAnnotationItems() call (e.g. after an add/clone)
            // does not rebuild the list from the old order and undo the drag.
            const newOrder = $annotationlist.find('tr[data-id]').not('.deleted').map(function() {
                return $(this).data('id');
            }).get();
            annotations = newOrder.map(id => annotations.find(x => x.id == id)).filter(x => x);

            // Update control bar navigation state to reflect new order
            if (activeid) {
                const current = annotations.find(a => a.id == activeid);
                if (current) {
                    updateControlBar(current);
                }
            }
        },
        helper: function(e, item) {
            if (!item.hasClass('b-active')) {
                return item;
            }

            // Build the combined drag helper from non-global selected rows only.
            const selecteditems = item.parent().find('tr.b-active').not('.global-interaction');

            const helper = $('<tr class="ui-sortable-helper"></tr>');
            selecteditems.each(function() {
                const $item = $(this);
                const $clone = $item.clone();
                helper.append($clone);
            });
            return helper;
        },
    });

    // ── Bulk-action toolbar ──────────────────────────────────────────────────
    // The HTML is rendered server-side by mod_flexbook/editor/bulktoolbar.
    // JS only needs a reference and the show/hide/sync helpers.
    const $bulkToolbar = $('#bulk-action-toolbar');

    const showBulkToolbar = (count) => {
        $('#bulk-count').text(count === 1 ? '1 item' : `${count} items`);
        $bulkToolbar.css('bottom', '24px');
    };

    const hideBulkToolbar = () => {
        $bulkToolbar.css('bottom', '-80px');
    };

    // Whether the clipboard holds interactions that can be pasted into this activity.
    const hasPasteableClipboard = () => {
        const raw = window.localStorage.getItem(CLIPBOARD_KEY);
        if (!raw) {
            return false;
        }
        const copied = safeParse(raw, []);
        if (!Array.isArray(copied) || copied.length === 0) {
            return false;
        }
        // Only same-site Flexbook items, and never the activity they were copied from.
        if (String(copied[0].cmid) === String(state.config.cmid)) {
            return false;
        }
        return copied.every(x => x.source === 'flexbook' && x.wwwroot === M.cfg.wwwroot);
    };

    // Show or hide the list footer paste bar based on clipboard contents.
    const syncPasteButton = () => {
        const canPaste = hasPasteableClipboard();
        const $footer = $('#annotation-list-footer');
        const $btn = $('#annotation-list-paste');

        if (!canPaste) {
            $footer.addClass('d-none');
            return;
        }

        $footer.removeClass('d-none');
        $btn.prop('disabled', false);
        $btn.addClass('btn-primary text-white').removeClass('btn-light');
        $btn.find('i').removeClass('bi-clipboard').addClass('bi-clipboard-plus');
    };

    // Recompute and refresh the bulk toolbar based on the current selection.
    const syncBulkToolbar = () => {
        const count = $annotationlist.find('tr.b-active').length;
        if (count > 0) {
            showBulkToolbar(count);
        } else {
            hideBulkToolbar();
        }
    };

    // Insert server-imported items into the local list (after an anchor, or at the end) and refresh.
    const insertImportedItems = (imported, afterid = 0) => {
        if (!Array.isArray(imported) || imported.length === 0) {
            return [];
        }
        const items = imported
            .filter(x => contentTypes.find(y => y.name === x.type))
            .map(x => {
                x.prop = JSON.stringify(contentTypes.find(y => y.name === x.type));
                x.editMode = true;
                return x;
            });
        if (items.length === 0) {
            return [];
        }
        if (afterid) {
            const idx = annotations.findIndex(a => String(a.id) === String(afterid));
            if (idx !== -1) {
                annotations.splice(idx + 1, 0, ...items);
            } else {
                annotations.push(...items);
            }
        } else {
            annotations.push(...items);
        }
        // Keep global interactions pinned to the top regardless of insert position.
        annotations = sortForEditList(annotations, annotations.filter(a => !isGlobalInteraction(a)).map(a => a.id));
        renderAnnotationItems(annotations);
        // Initialize single-instance renderers that react to being added.
        items.forEach(int => {
            const ct = contentTypes.find(y => y.name === int.type);
            if (ct && !ct.allowmultiple && ctRenderer[int.type] && typeof ctRenderer[int.type].init === 'function') {
                ctRenderer[int.type].init();
            }
        });
        return items;
    };
    // ── End bulk-action toolbar ───────────────────────────────────────────────

    // Initialize the content type renderers for interactive video annotations.
    let initContentTypes = await Promise.all(contentTypes.map((contentType) => {
        return new Promise((resolve) => {
            if (!contentType.fbamdmodule) {
                ctRenderer[contentType.name] = null;
                resolve();
                return;
            }
            require([contentType.fbamdmodule], function(Type) {
                Type = Type.default || Type;
                ctRenderer[contentType.name] = new Type(annotations, contentType);
                resolve();
            });
        });
    }));

    await Promise.all(initContentTypes);

    renderAnnotationItems(annotations, true, aid ? false : true);

    // Use ResizeObserver for more robust resizing
    if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => {
            resizePreview();
        });
        ro.observe($('#editor-stage-main')[0]);
    } else {
        $(window).on('resize', resizePreview);
    }
    setTimeout(resizePreview, 200);
    initResizableSidebar();

    let ModalFactory;
    if (getMoodleVersion() >= 403 || $('body').hasClass('bs-5')) {
        ModalFactory = await import('core/modal');
    } else {
        ModalFactory = await import('core/modal_factory');
    }

    // Launch content selection modal.
    let contentTypeModal;
    const initContentTypeModal = async() => {
        if (contentTypeModal) {
            contentTypeModal.show();
            return;
        }

        contentTypeModal = await ModalFactory.create({
            title: '',
            body: '',
            removeOnHide: false,
        });
        let root = contentTypeModal.getRoot();
        let $body = $('#contentmodal-original .modal-content').html();
        root.attr('id', 'contentmodal');
        root.find('.modal-dialog .modal-content').html($body);
        contentTypeModal.show();

        root.on(ModalEvents.outsideClick, function(e) {
            e.preventDefault();
            root.addClass('jelly-anim');
            setTimeout(() => {
                root.removeClass('jelly-anim');
            }, 500);
        });

        root.on(ModalEvents.hidden, function() {
            $('#addcontentdropdown .dropdown-item').removeClass('active');
        });

        root.on(ModalEvents.shown, function() {
            // Apply jelly animation after DOM is ready
            setTimeout(() => {
                root.addClass('jelly-anim');
                setTimeout(() => {
                    root.removeClass('jelly-anim');
                }, 500);
            }, 10);

            // Make the modal draggable.
            root.find('.modal-dialog').draggable({
                handle: ".modal-header"
            });

            // Focus on search box.
            root.find('#contentsearch').focus();
        });

        root.on('click', '.modal-header [type="button"]', function() {
            contentTypeModal.hide();
        });

        root.on('click', '.dropdown-item', function() {
            root.removeClass('jelly-anim');
            contentTypeModal.hide();
        });

        // Implement content type filter.
        root.on('keyup', '#contentsearch', function() {
            let search = $(this).val().toLowerCase();

            root.find('#addcontentdropdown .dropdown-item').removeClass('d-none').addClass('d-flex');

            if (search == '') {
                return;
            }

            root.find('#addcontentdropdown .dropdown-item').each(function() {
                let text = $(this).find('.contenttype-title').text().toLowerCase();
                if (text.includes(search)) {
                    $(this).addClass('d-flex').removeClass('d-none');
                } else {
                    $(this).addClass('d-none').removeClass('d-flex');
                }
            });
        });
    };

    $(document).on('click', '#addinteractionbtn', async function(e) {
        e.preventDefault();
        await initContentTypeModal();
    });

    let beforeItem = null;
    $(document).on('click', 'tr.annotation .insertafter', async function(e) {
        e.preventDefault();
        const $next = $(this).closest('tr.annotation').next();
        if ($next.length == 0) {
            beforeItem = null;
        } else {
            beforeItem = $next.attr('data-id');
        }
        await initContentTypeModal();
    });

    $(document).on('click', 'tr.annotation .insertbefore', async function(e) {
        e.preventDefault();
        beforeItem = $(this).closest('tr.annotation').attr('data-id');
        await initContentTypeModal();
    });

    // Implement create annotation
    $(document).on('click', '#addcontentdropdown .dropdown-item', async function(e) {
        $('#addcontentdropdown .dropdown-item').removeClass('active');
        // Check if the target item is a link.
        if ($(e.target).is('a')) {
            return;
        }

        const ctype = $(this).data('type');
        const ct = contentTypes.find(x => x.name === ctype);
        if (ct && !ct.allowmultiple && annotations.some(a => a.type === ctype)) {
            addNotification(
                await getString('thisinteractionalreadyexists', 'mod_interactivevideo', ct.title), 'danger');
            return;
        }
        ctRenderer[ctype].addAnnotation(annotations);
    });

    $annotationlist.on('click', 'tr', function(e) {
        if (e.ctrlKey) {
            $(this).toggleClass('b-active');
            syncBulkToolbar();
        }
    });

    // Implement more actions.
    $(document).on('click', 'tr.annotation .more-actions', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        const $wrapper = $(this).closest('.btns');
        // Remove any existing menus.
        $('.more-actions-menu.show').remove();

        const $menu = $moreactionsmenu.clone();

        // Global interactions cannot be cloned or inserted before (pinned to top).
        // Insert after remains available so the first page can be added when only a global exists.
        if ($(this).closest('tr.annotation').hasClass('global-interaction')) {
            $menu.find('.copy, .insertbefore, .dropdown-divider').remove();
        }

        $menu.removeClass('d-none').addClass('show');
        $wrapper.append($menu);

        // Use a slight delay to avoid immediate closing if the click bubbled.
        setTimeout(() => {
            $(document).one('click', function() {
                $menu.remove();
            });
        }, 10);
    });

    $(document).on('paste', async function(e) {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
            return;
        }

        const $selected = $annotationlist.find('tr.annotation.b-active');
        const anchorid = $selected.length ? $selected.last().data('id') : null;

        const files = e.originalEvent.clipboardData.files;
        if (files.length === 0) {
            return;
        }

        // Non-pack files need a selected anchor row; .fbz packs can be pasted anywhere.
        const hasFbz = Array.from(files).some(f => f.name.toLowerCase().endsWith('.fbz'));
        if (!anchorid && !hasFbz) {
            return;
        }

        e.preventDefault();
        await handleFileDrop(files, anchorid);
        // Dismiss selection and toolbar.
        $annotationlist.find('tr.b-active').removeClass('b-active');
        hideBulkToolbar();

        if (navigator.clipboard.writeText) {
            await navigator.clipboard.writeText('');
        }
    });

    // Implement view annotation.
    $(document).on('click', 'tr.annotation .title', async function(e) {
        if (e.ctrlKey || e.metaKey || state.isDnDInProgress) {
            return;
        }
        e.preventDefault();
        const id = $(this).closest('.annotation').data('id');
        const theAnnotation = annotations.find(annotation => annotation.id == id);
        await previewInStage(theAnnotation);
    });

    // Control bar navigation
    $(document).on('click', '#prevanno', async function() {
        const currentId = $annotationlist.find('tr.active-preview').data('id');
        const index = annotations.findIndex(a => a.id == currentId);
        if (index > 0) {
            await previewInStage(annotations[index - 1]);
        }
    });

    $(document).on('click', '#nextanno', async function() {
        const currentId = $annotationlist.find('tr.active-preview').data('id');
        const index = annotations.findIndex(a => a.id == currentId);
        if (index < annotations.length - 1) {
            await previewInStage(annotations[index + 1]);
        }
    });


    // Floating Edit Button
    $(document).on('click', '#editor-edit-btn', function() {
        const id = $(this).data('id');
        const type = $(this).data('type');
        if (id && type) {
            ctRenderer[type].editAnnotation(annotations, id);
        }
    });

    // Sidebar Toggle
    $(document).on('click', '#sidebar-toggle', function() {
        const $sidebar = $('#editor-sidebar');
        const storageKey = `mod_flexbook_sidebar_width_${cmid}`;
        const minWidth = 320;
        const maxWidth = Math.max(minWidth, Math.floor($(window).width() * 0.75));
        $sidebar.toggleClass('collapsed');
        if ($sidebar.hasClass('collapsed')) {
            $sidebar.css({
                width: '0',
                minWidth: '0',
            });
        } else {
            const savedWidth = parseInt(window.localStorage.getItem(storageKey), 10) || 380;
            const nextWidth = Math.min(maxWidth, Math.max(minWidth, savedWidth));
            $sidebar.css({
                width: nextWidth + 'px',
                minWidth: nextWidth + 'px',
            });
        }
        // Trigger resize after a short delay to account for CSS transitions
        setTimeout(resizePreview, 100);
        setTimeout(resizePreview, 350);
    });

    // Implement edit annotation
    $(document).on('click', 'tr.annotation .edit', async function(e) {
        e.preventDefault();
        const id = $(this).closest('.annotation').data('id');
        const contenttype = $(this).closest('.annotation').data('type');
        ctRenderer[contenttype].editAnnotation(annotations, id);
    });

    // Implement copy annotation
    $(document).on('click', 'tr.annotation .copy', async function(e) {
        e.preventDefault();
        const id = $(this).closest('.annotation').data('id');
        const contenttype = $(this).closest('.annotation').data('type');
        // Find the beforeItem.
        let $next = $(this).closest('tr.annotation').next();
        if ($next.length == 0) {
            beforeItem = null;
        } else {
            beforeItem = $next.attr('data-id');
        }
        ctRenderer[contenttype].cloneAnnotation(id);
    });

    // Implement delete annotation.
    $(document).on('click', 'tr.annotation .delete', async function(e) {
        e.preventDefault();
        const id = $(this).closest('.annotation').data('id');
        const annotation = annotations.find(annotation => annotation.id == id);
        const title = await getString('deleteinteraction', 'mod_interactivevideo');
        const body = await getString('deleteinteractionconfirm', 'mod_interactivevideo');
        const button = await getString('delete', 'mod_interactivevideo');
        try {
            Notification.deleteCancelPromise(
                title,
                body,
                button,
            ).then(() => {
                return ctRenderer[annotation.type].deleteAnnotation(annotations, id);
            }).catch(() => {
                return;
            });
        } catch {
            Notification.saveCancel(
                title,
                body,
                button,
                function() {
                    return ctRenderer[annotation.type].deleteAnnotation(annotations, id);
                }
            );
        }
    });

    // Quick edit.
    $(document).on('contextmenu', '[data-editable]', function(e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if ($('[data-field].editing').length > 0) {
            return;
        }
        const fld = $(this).data('editable');
        $(this).hide();
        $(this).siblings('[data-field="' + fld + '"]').removeClass('d-none').focus().addClass('editing');
    });

    $(document).on('keyup', '[data-field].editing', async function(e) {
        $(this).removeClass('is-invalid');
        const initialValue = $(this).data('initial-value');
        const val = $(this).val();
        const fld = $(this).data('field');
        if (val == '') {
            $(this).addClass('is-invalid');
        }

        // If escape key is pressed, revert the value.
        if (e.key == 'Escape') {
            $(this).val(initialValue);
            $(this).removeClass('editing');
            $(this).addClass('d-none');
            $(this).siblings('[data-editable]').show();
            $('.timestamp-info').remove();
            return;
        }
        // If enter key is pressed, save the value.
        if (e.key == 'Enter') {
            if ($(this).hasClass('is-invalid')) {
                return;
            }
            if (val == initialValue) {
                $(this).removeClass('editing');
                $(this).addClass('d-none');
                $(this).siblings('[data-editable]').show();
                return;
            }
            const id = $(this).data('id');
            const anno = await Ajax.call([{
                methodname: 'mod_flexbook_quickedit',
                args: {
                    id: id,
                    field: fld,
                    value: val,
                    contextid: M.cfg.contextid,
                    draftitemid: 0
                }
            }])[0];
            const updated = safeParse(anno.data, {});
            dispatchEvent('annotationupdated', {
                annotation: updated,
                action: 'edit',
                isQuickEdit: true
            });
            return;
        }
    });

    $(document).on('blur', '[data-field].editing', function() {
        const initialValue = $(this).data('initial-value');
        $(this).val(initialValue);
        $(this).removeClass('editing');
        $(this).addClass('d-none');
        $(this).siblings('[data-editable]').show();
        $('.timestamp-info').remove();
    });
    // End quick edit.

    // Post annotation update (add, edit, clone).
    $(document).on('annotationupdated', async function(e) {
        const action = e.originalEvent.detail.action;
        const isDnD = e.originalEvent.detail.isDnD;
        const isQuickEdit = e.originalEvent.detail.isQuickEdit;
        let updated = e.originalEvent.detail.annotation;
        updated.prop = JSON.stringify(contentTypes.find(x => x.name === updated.type));
        if (action == 'edit') {
            annotations = annotations.map(x => {
                if (x.id == updated.id) {
                    return updated;
                }
                return x;
            });
        }

        const wasPreviewingId = activeid;

        if (action == 'add' || action == 'clone' || action == 'edit') {
            const anchorid = e.originalEvent.detail.anchorid;
            // Add the new annotation after the anchorid, before the beforeItem, or at the end.
            if (action == 'add' || action == 'clone') {
                if (anchorid) {
                    const index = annotations.findIndex(x => x.id == anchorid);
                    if (index !== -1) {
                        annotations.splice(index + 1, 0, updated);
                    } else {
                        annotations.push(updated);
                    }
                } else if (beforeItem) {
                    annotations.splice(annotations.findIndex(x => x.id == beforeItem), 0, updated);
                } else {
                    annotations.push(updated);
                }
            }

            // Keep global interactions pinned to the top after any insertion.
            if (action == 'add' || action == 'clone') {
                annotations = sortForEditList(annotations, annotations.filter(a => !isGlobalInteraction(a)).map(a => a.id));
            }

            if (action == 'add') {
                if (!isDnD) {
                    activeid = updated.id;
                }
            } else if (action == 'edit') {
                if (!e.originalEvent.detail.isQuickEdit) {
                    // Only update activeid if we want to force refresh it later.
                    // But wait, the user said only refresh if the CURRENT one is edited.
                    // So we don't change activeid here if it was different.
                }
            }
        }

        let refreshPreview = false;
        if (action == 'add' && !isDnD) {
            // New interaction added (not via DnD or Clone): Preview it.
            refreshPreview = true;
        } else if (action == 'edit' && !isQuickEdit) {
            // Only refresh if the edited interaction IS the one currently in the stage.
            if (updated.id == wasPreviewingId) {
                refreshPreview = true;
            }
        }
        annotations.map(x => {
            x.editMode = true;
            return x;
        });
        if (!state.isBulkDnD) {
            renderAnnotationItems(annotations, refreshPreview);
        }
        if (action == 'add' || action == 'clone') {
            if (!state.isBulkDnD) {
                addNotification(await getString('interactionadded', 'mod_interactivevideo'), 'success');
                const addResult = await saveDraft();
                if (addResult.status != 'success') {
                    addNotification(await getString('anerroroccured', 'mod_flexbook'), 'danger');
                }
            }
        } else if (action == 'edit') {
            addNotification(await getString('interactionupdated', 'mod_interactivevideo'), 'success');
        }
        $annotationlist.find(`tr[data-id="${updated.id}"]`).addClass('active');
        setTimeout(function() {
            $annotationlist.find(`tr[data-id="${updated.id}"]`).removeClass('active');
        }, 1500);
    });

    // Re-render annotation list and timeline after an annotation is deleted.
    $(document).on('annotationdeleted', async function(e) {
        // Remove any tooltips that may be open.
        $('.tooltip').remove();
        const deletedAnnotation = e.originalEvent.detail.annotation;

        let refreshPreview = false;
        if (activeid == deletedAnnotation.id) {
            // Find the next best item to preview before we remove this one.
            const currentIndex = annotations.findIndex(a => a.id == deletedAnnotation.id);
            const nextAnno = annotations[currentIndex + 1] || annotations[currentIndex - 1];
            activeid = nextAnno ? nextAnno.id : null;
            refreshPreview = true;
        }

        $annotationlist.find(`tr[data-id="${deletedAnnotation.id}"]`).addClass('deleted');
        syncBulkToolbar(); // Recount in case the deleted row was selected.
        setTimeout(async function() {
            const index = annotations.findIndex(item => item.id == deletedAnnotation.id);
            if (index !== -1) {
                annotations.splice(index, 1);
            }
            renderAnnotationItems(annotations, refreshPreview);
            // Save after the deleted row is removed from the DOM so the
            // sequence written to the server does not include the deleted id.
            const deleteResult = await saveDraft();
            if (deleteResult.status != 'success') {
                addNotification(await getString('anerroroccured', 'mod_flexbook'), 'danger');
            }
            addNotification(await getString('interactiondeleted', 'mod_interactivevideo'), 'success');
        }, 1000);
        if ($($('#annotation-list-bulk-edit')).hasClass('active')) {
            $('#annotation-list-bulk-edit').trigger('click');
        }
    });

    const saveDraft = async() => {
        // Ensure global interactions are pinned to the top before snapshotting order.
        enforceGlobalPrefixInDom($annotationlist);
        // Get the current sequence based on the tr data-id.
        // Exclude rows that are mid-deletion (.deleted) so the saved sequence
        // is never polluted with IDs that are about to be removed.
        const trarray = $annotationlist.find('tr[data-id]').not('.deleted').map(function() {
            return $(this).data('id');
        }).get();
        sequence = trarray.join(',');
        let result = await Ajax.call([{
            methodname: 'mod_flexbook_update_sequence',
            args: {
                contextid: M.cfg.contextid,
                instanceid: flexbook,
                sequence,
            }
        }])[0];

        if (result.status == 'success') {
            $('#savedraft').prop('disabled', true);
        }

        return result;

    };

    // Save draft.
    $(document).on('click', '#savedraft', async function(e) {
        e.preventDefault();
        let saved = await saveDraft();
        if (saved.status != 'success') {
            addNotification(await getString('anerroroccured', 'mod_flexbook'), 'danger');
            return;
        }
        addNotification(await getString('draftsaved', 'mod_flexbook'), 'success');
    });


    // Deselect all rows when the user clicks outside #editor-sidebar.
    $(document).on('click', function(e) {
        if (!$(e.target).closest('#editor-sidebar').length && !$(e.target).closest('.more-actions-menu').length) {
            $annotationlist.find('tr.b-active').removeClass('b-active');
            // Keep the toolbar visible if there is something to paste.
            syncBulkToolbar();
        }
    });

    // Bulk toolbar: dismiss button clears the selection.
    $(document).on('click', '#bulk-dismiss-btn', function() {
        $annotationlist.find('tr.b-active').removeClass('b-active');
        hideBulkToolbar();
    });

    // Bulk toolbar: delete button.
    $(document).on('click', '#bulk-delete-btn', async function() {
        const $selected = $annotationlist.find('tr.b-active');
        const ids = $selected.map(function() {
            return $(this).data('id');
        }).get();
        if (!ids.length) {
            return;
        }

        const title = await getString('deleteinteraction', 'mod_interactivevideo');
        const body = await getString('bulkdeleteconfirm', 'mod_flexbook', ids.length);
        const button = await getString('delete', 'mod_interactivevideo');

        const doDelete = async() => {
            const deletedSet = new Set(ids.map(String));
            let refreshPreview = false;

            if (activeid && deletedSet.has(String(activeid))) {
                // Find the first item that is NOT being deleted to transition to.
                const nextAnno = annotations.find(a => !deletedSet.has(String(a.id)));
                activeid = nextAnno ? nextAnno.id : null;
                refreshPreview = true;
            }

            // Visually mark rows as being removed.
            $selected.addClass('deleted');
            hideBulkToolbar();

            // Delete all items in parallel.
            const results = await Promise.all(ids.map(id => Ajax.call([{
                methodname: 'mod_flexbook_delete',
                args: {
                    contextid: M.cfg.contextid,
                    id: id,
                    cmid: state.config.cmid,
                }
            }])[0]));

            const failed = results.filter(r => r.status !== 'success').length;

            // Wait for the fade-out animation, then re-render and persist.
            setTimeout(async function() {
                // Remove successfully deleted IDs from the annotations array in-place.
                for (let i = annotations.length - 1; i >= 0; i--) {
                    if (deletedSet.has(String(annotations[i].id))) {
                        annotations.splice(i, 1);
                    }
                }

                renderAnnotationItems(annotations, refreshPreview);
                const result = await saveDraft();
                if (result.status !== 'success' || failed > 0) {
                    addNotification(await getString('anerroroccured', 'mod_flexbook'), 'danger');
                } else {
                    addNotification(
                        await getString('bulkdeleted', 'mod_flexbook', ids.length), 'success');
                }
            }, 1000);
        };

        try {
            Notification.deleteCancelPromise(title, body, button)
                .then(() => doDelete())
                .catch(() => {
                    // Ignore.
                });
        } catch {
            Notification.saveCancel(title, body, button, doDelete);
        }
    });

    // Bulk toolbar: clone button.
    $(document).on('click', '#bulk-clone-btn', async function() {
        // Global / single-instance interactions cannot be cloned.
        const $selected = $annotationlist.find('tr.b-active').not('.global-interaction');
        const ids = $selected.map(function() {
            return $(this).data('id');
        }).get();
        if (!ids.length) {
            return;
        }

        // Find the last selected item's index in the annotations array.
        const lastSelectedId = ids[ids.length - 1];
        const lastIndex = annotations.findIndex(a => a.id == lastSelectedId);

        // Visually indicate progress.
        $selected.addClass('moving');
        $('#bulk-clone-btn').prop('disabled', true).addClass('loading');

        try {
            // Clone all items in parallel.
            const results = await Promise.all(ids.map(id => Ajax.call([{
                methodname: 'mod_flexbook_duplicate',
                args: {
                    contextid: M.cfg.contextid,
                    id: id,
                }
            }])[0]));

            const newItems = results.filter(r => r.status === 'success').map(r => {
                const item = safeParse(r.data, {});
                item.prop = JSON.stringify(contentTypes.find(x => x.name === item.type));
                item.editMode = true;
                return item;
            });

            if (newItems.length > 0) {
                // Insert the new items after the last selected item.
                annotations.splice(lastIndex + 1, 0, ...newItems);

                renderAnnotationItems(annotations);
                await saveDraft();

                addNotification(await getString('bulkcloned', 'mod_flexbook', newItems.length), 'success');
            }

            if (newItems.length < ids.length) {
                addNotification(await getString('anerroroccured', 'mod_flexbook'), 'danger');
            }

        } catch (error) {
            addNotification(await getString('anerroroccured', 'mod_flexbook'), 'danger');
        } finally {
            $selected.removeClass('moving').removeClass('b-active');
            $('#bulk-clone-btn').prop('disabled', false).removeClass('loading');
            hideBulkToolbar();
        }
    });

    // Bulk toolbar: copy selected interactions to the clipboard (cross-activity).
    $(document).on('click', '#bulk-copy-btn', async function() {
        const ids = $annotationlist.find('tr.b-active').map(function() {
            return String($(this).data('id'));
        }).get();
        if (!ids.length) {
            addNotification(await getString('copynothingselected', 'mod_flexbook'), 'danger');
            return;
        }
        // Preserve the on-screen order and tag the payload for safe pasting.
        const selected = annotations
            .filter(a => ids.includes(String(a.id)))
            .map(a => {
                const clean = {...a};
                delete clean.editMode;
                clean.source = 'flexbook';
                clean.wwwroot = M.cfg.wwwroot;
                return clean;
            });
        window.localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(selected));
        $annotationlist.find('tr.b-active').removeClass('b-active');
        hideBulkToolbar();
        addNotification(await getString('copysuccess', 'mod_flexbook', selected.length), 'success');
    });

    // List footer: paste interactions from the clipboard.
    $(document).on('click', '#annotation-list-paste', async function() {
        const raw = window.localStorage.getItem(CLIPBOARD_KEY);
        if (!raw) {
            return;
        }
        let copied = safeParse(raw, []);
        if (!Array.isArray(copied) || copied.length === 0) {
            return;
        }
        // Same-site Flexbook items only, and only enabled content types.
        copied = copied.filter(x => x.source === 'flexbook' && x.wwwroot === M.cfg.wwwroot);
        copied = copied.filter(x => contentTypes.find(y => y.name === x.type));
        // Respect content types that may only appear once per activity.
        copied = copied.filter(x => {
            const ct = contentTypes.find(y => y.name === x.type);
            return ct && (ct.allowmultiple || !annotations.find(a => a.type === x.type));
        });
        if (copied.length === 0) {
            addNotification(await getString('pastefailed', 'mod_flexbook'), 'danger');
            return;
        }

        const $selected = $annotationlist.find('tr.b-active');
        const afterid = $selected.length ? $selected.last().data('id') : 0;

        $('#annotation-list-paste').prop('disabled', true).addClass('loading');
        try {
            const result = await Ajax.call([{
                methodname: 'mod_flexbook_import_items',
                args: {
                    contextid: M.cfg.contextid,
                    fromcourse: copied[0].courseid,
                    tocourse: state.config.courseid,
                    fromcm: copied[0].cmid,
                    tocm: state.config.flexbook,
                    module: state.config.cmid,
                    items: JSON.stringify(copied),
                    afterid: afterid || 0,
                }
            }])[0];
            insertImportedItems(safeParse(result.data, []), afterid);
            await saveDraft();
            addNotification(await getString('importsuccess', 'mod_flexbook', copied.length), 'success');
        } catch (error) {
            addNotification(await getString('anerroroccured', 'mod_flexbook'), 'danger');
        } finally {
            $('#annotation-list-paste').prop('disabled', false).removeClass('loading');
            $annotationlist.find('tr.b-active').removeClass('b-active');
            syncBulkToolbar();
            syncPasteButton();
        }
    });

    // Bulk toolbar: export selected interactions as a downloadable .fbz pack.
    $(document).on('click', '#bulk-download-btn', async function() {
        const ids = $annotationlist.find('tr.b-active').map(function() {
            return String($(this).data('id'));
        }).get();
        if (!ids.length) {
            addNotification(await getString('exportnothingselected', 'mod_flexbook'), 'danger');
            return;
        }
        const selected = annotations
            .filter(a => ids.includes(String(a.id)))
            .map(a => {
                const clean = {...a};
                delete clean.editMode;
                delete clean.prop;
                return clean;
            });
        $('#bulk-download-btn').prop('disabled', true).addClass('loading');
        try {
            const result = await Ajax.call([{
                methodname: 'mod_flexbook_download_items',
                args: {
                    contextid: M.cfg.contextid,
                    cmid: state.config.cmid,
                    courseid: state.config.courseid,
                    items: JSON.stringify(selected).replace(/</g, '&lt;').replace(/>/g, '&gt;'),
                }
            }])[0];
            if (result.status === 'success' && result.data) {
                window.open(result.data, '_blank');
            }
        } catch (error) {
            addNotification(await getString('anerroroccured', 'mod_flexbook'), 'danger');
        } finally {
            $('#bulk-download-btn').prop('disabled', false).removeClass('loading');
            $annotationlist.find('tr.b-active').removeClass('b-active');
            hideBulkToolbar();
        }
    });

    // Bulk toolbar: save selected interactions as course defaults for their content type.
    $(document).on('click', '#bulk-setdefault-btn', async function() {
        const ids = $annotationlist.find('tr.b-active').map(function() {
            return String($(this).data('id'));
        }).get();
        if (!ids.length) {
            addNotification(await getString('setdefaultnothingselected', 'mod_flexbook'), 'danger');
            return;
        }
        // One default per content type: keep the first selected item of each type.
        const seen = {};
        const selected = annotations
            .filter(a => ids.includes(String(a.id)))
            .filter(a => {
                if (seen[a.type]) {
                    return false;
                }
                seen[a.type] = true;
                return true;
            })
            .map(a => {
                const clean = {...a};
                delete clean.editMode;
                delete clean.prop;
                return clean;
            });
        $('#bulk-setdefault-btn').prop('disabled', true).addClass('loading');
        try {
            await Ajax.call([{
                methodname: 'mod_flexbook_save_defaults',
                args: {
                    contextid: M.cfg.contextid,
                    courseid: state.config.courseid,
                    defaults: JSON.stringify(selected),
                }
            }])[0];
            addNotification(await getString('savedasdefaults', 'mod_flexbook'), 'success');
        } catch (error) {
            addNotification(await getString('anerroroccured', 'mod_flexbook'), 'danger');
        } finally {
            $('#bulk-setdefault-btn').prop('disabled', false).removeClass('loading');
            $annotationlist.find('tr.b-active').removeClass('b-active');
            hideBulkToolbar();
        }
    });

    // Update the footer paste button when another tab copies interactions.
    window.addEventListener('storage', function(e) {
        if (e.key === CLIPBOARD_KEY) {
            syncPasteButton();
        }
    });

    // Surface the paste affordance on load if the clipboard already holds items.
    syncPasteButton();

    // Warn before leaving the page if there are unsaved changes.
    window.addEventListener('beforeunload', (e) => {
        if (!$('#savedraft').is(':disabled')) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    // ── Drag and Drop Files ─────────────────────────────────────────────────
    const $dropZone = $('#editor-sidebar');
    let dragCounter = 0;

    $dropZone.on('dragenter', function(e) {
        e.preventDefault();
        e.stopPropagation();
        dragCounter++;
        $(this).addClass('dragover');
        state.isDnDInProgress = true;
    });

    $dropZone.on('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
    });

    $dropZone.on('dragleave dragend', function(e) {
        e.preventDefault();
        e.stopPropagation();
        dragCounter--;
        if (dragCounter <= 0) {
            $(this).removeClass('dragover');
            dragCounter = 0;
            state.isDnDInProgress = false;
        }
    });

    $dropZone.on('drop', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).removeClass('dragover');
        dragCounter = 0;
        const files = e.originalEvent.dataTransfer.files;
        if (files.length > 0) {
            // Check if we dropped on a specific item.
            const $targetRow = $(e.originalEvent.target).closest('tr[data-id]');
            const anchorid = $targetRow.length ? $targetRow.data('id') : null;
            await handleFileDrop(files, anchorid);
        }
        // Use a small timeout before clearing the flag to block any trailing click events.
        setTimeout(() => {
            state.isDnDInProgress = false;
        }, 200);
    });

    // Handle dragover on specific items for insertion.
    $annotationlist.on('dragover dragenter', 'tr[data-id]', function() {
        $(this).addClass('dnd-target');
    });

    $annotationlist.on('dragleave dragend drop', 'tr[data-id]', function() {
        $(this).removeClass('dnd-target');
    });

    /**
     * Updates the DnD progress bar at the bottom right.
     * @param {Number} percent
     * @param {String} fileName
     */
    const updateDnDProgress = async(percent, fileName = '') => {
        let $container = $('#dnd-progress-container');
        if (!$container.length) {
            $container = $(`
                <div id="dnd-progress-container" class="bg-white p-3 rounded shadow-lg border"
                     style="position:fixed; bottom:20px; right:20px; width:320px; z-index:9999; display:none;">
                    <div class="d-flex justify-content-between mb-2 small iv-font-weight-bold text-dark">
                        <span id="dnd-progress-label" class="text-truncate iv-mr-2" style="max-width: 200px;"></span>
                        <span id="dnd-progress-percent">0%</span>
                    </div>
                    <div class="progress" style="height: 10px; background-color: #e9ecef;">
                        <div class="progress-bar progress-bar-striped progress-bar-animated bg-primary"
                             role="progressbar" style="width: 0%"></div>
                    </div>
                </div>
            `).appendTo('body');
            $container.fadeIn();
        }

        const label = fileName ? await getString('processingfile', 'mod_flexbook', fileName) : '';
        if (label) {
            $container.find('#dnd-progress-label').text(label).attr('title', fileName);
        }
        $container.find('#dnd-progress-percent').text(Math.round(percent) + '%');
        $container.find('.progress-bar').css('width', percent + '%');

        if (percent >= 100) {
            const savedStr = await getString('draftsaved', 'mod_flexbook');
            $container.find('#dnd-progress-label').text(savedStr);
            setTimeout(() => {
                $container.fadeOut(() => $container.remove());
            }, 2000);
        }
    };

    // Import one or more uploaded .fbz packs using the existing draft-upload pipeline.
    const importFbzPacks = async(packs, anchorid = null) => {
        for (const pack of packs) {
            addNotification(await getString('uploading', 'mod_flexbook', pack.name), 'info');
            try {
                const uploaded = await uploadFileToDraftArea(pack);
                const result = await Ajax.call([{
                    methodname: 'mod_flexbook_import_pack',
                    args: {
                        contextid: M.cfg.contextid,
                        instanceid: state.config.flexbook,
                        module: state.config.cmid,
                        courseid: state.config.courseid,
                        draftitemid: uploaded.itemid,
                        afterid: anchorid || 0,
                    }
                }])[0];
                const data = safeParse(result.data, {items: []});
                const imported = insertImportedItems(data.items || [], anchorid || 0);
                await saveDraft();
                addNotification(await getString('importsuccess', 'mod_flexbook', imported.length), 'success');
            } catch (error) {
                const reason = formatUploadErrorMessage(error);
                const msg = reason
                    ? await getString('erroruploadingdetail', 'mod_flexbook', {file: pack.name, reason})
                    : await getString('erroruploading', 'mod_flexbook', pack.name);
                addNotification(msg, 'danger');
            }
        }
    };

    const handleFileDrop = async(files, anchorid = null) => {
        const fileArray = Array.from(files);
        // Flexbook packs are imported directly, regardless of content-type plugins.
        const fbzPacks = fileArray.filter(f => f.name.toLowerCase().endsWith('.fbz'));
        if (fbzPacks.length > 0) {
            await importFbzPacks(fbzPacks, anchorid);
            return;
        }
        for (const ct of contentTypes) {
            const renderer = ctRenderer[ct.name];
            if (renderer && typeof renderer.handleFileDrop === 'function') {
                const handled = await renderer.handleFileDrop(fileArray, anchorid, {
                    addNotification,
                    updateDnDProgress,
                    renderAnnotationItems,
                    saveDraft,
                    annotations,
                    state,
                });
                if (handled) {
                    return;
                }
            }
        }

        const queue = [];
        let globalSelectedPlugin = null;
        let applyToAll = false;

        // Phase 1: Validation & Plugin Selection
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const ext = file.name.split('.').pop().toLowerCase();
            const supportingPlugins = contentTypes.filter(ct => {
                return ct.dndextensions && ct.dndextensions.includes(ext);
            });

            if (supportingPlugins.length === 0) {
                // Silently skip
                continue;
            }

            let selectedPlugin = null;

            // If "Apply to All" was previously checked, try to reuse the selection.
            if (applyToAll && globalSelectedPlugin) {
                for (const p of supportingPlugins) {
                    if (p.name === globalSelectedPlugin.name) {
                        selectedPlugin = globalSelectedPlugin;
                        break;
                    }
                }
            }

            if (!selectedPlugin) {
                if (supportingPlugins.length > 1) {
                    const result = await showPluginSelectionModal(file, supportingPlugins, files.length > 1);
                    if (!result || result.plugin === null) {
                        if (result && result.applyToAll) {
                            break; // Cancel all remaining files
                        }
                        continue; // User cancelled this file only
                    }
                    selectedPlugin = result.plugin;
                    if (result.applyToAll) {
                        globalSelectedPlugin = selectedPlugin;
                        applyToAll = true;
                    }
                } else {
                    selectedPlugin = supportingPlugins[0];
                }
            }

            queue.push({file, plugin: selectedPlugin});
        }

        if (queue.length === 0) {
            return;
        }

        // Phase 2: Consolidated Upload
        state.isBulkDnD = true;
        let createdCount = 0;

        for (let i = 0; i < queue.length; i++) {
            const {file, plugin} = queue[i];
            const progress = (i / queue.length) * 100;
            await updateDnDProgress(progress, file.name);

            try {
                await processFileUpload(file, plugin, anchorid);
                createdCount++;
            } catch (e) {
                window.console.error("Upload failed for " + file.name, e);
            }
        }

        // Phase 3: Finalize
        await updateDnDProgress(100);
        state.isBulkDnD = false;

        if (createdCount > 0) {
            addNotification(await getString('interactionscreated', 'mod_flexbook', createdCount), 'success');
            await renderAnnotationItems(annotations, false);
            await saveDraft();
        }
    };

    const processFileUpload = async(file, plugin, anchorid = null) => {
        // If not bulk, show individual notification
        if (!state.isBulkDnD) {
            addNotification(await getString('uploading', 'mod_flexbook', file.name), 'info');
        }

        let response = null;
        try {
            const ext = file.name.split('.').pop().toLowerCase();
            if (plugin.name === 'richtext') {
                const content = await file.text();
                response = {content: content};
            } else if (ext === 'zip' && plugin.name === 'fbboard') {
                response = {};
            } else {
                if (ctRenderer[plugin.name] && typeof ctRenderer[plugin.name].validateDnDFile === 'function') {
                    await ctRenderer[plugin.name].validateDnDFile(file);
                }
                const data = await uploadFileToDraftArea(file);
                response = {draftitemid: data.itemid, url: data.url};
            }
        } catch (error) {
            window.console.error("processFileUpload upload error:", error);
            if (error.message !== 'cancelled') {
                const reason = formatUploadErrorMessage(error);
                const msg = reason
                    ? await getString('erroruploadingdetail', 'mod_flexbook', {file: file.name, reason})
                    : await getString('erroruploading', 'mod_flexbook', file.name);
                addNotification(msg, 'danger');
            }
            throw error;
        }

        try {
            if (ctRenderer[plugin.name] && typeof ctRenderer[plugin.name].dnd === 'function') {
                const dndResult = await ctRenderer[plugin.name].dnd(annotations, file, response, anchorid);
                if (dndResult === false) {
                    throw new Error('cancelled');
                }
            } else {
                const result = await Ajax.call([{
                    methodname: 'mod_flexbook_create_interaction',
                    args: {
                        contextid: M.cfg.contextid,
                        courseid: state.config.courseid,
                        cmid: state.config.cmid,
                        annotationid: state.config.flexbook,
                        type: plugin.name,
                        title: file.name.replace(/\.[^/.]+$/, ""),
                        content: response.content || '',
                        draftitemid: response.draftitemid || 0,
                        anchorid: anchorid || 0,
                        url: response.url || '',
                    }
                }])[0];

                const newItem = safeParse(result.data, {});
                dispatchEvent('annotationupdated', {
                    annotation: newItem,
                    action: 'add',
                    anchorid: anchorid,
                    isDnD: true
                });
            }
        } catch (error) {
            window.console.error("processFileUpload create error:", error);
            if (error.message !== 'cancelled') {
                const reason = formatUploadErrorMessage(error);
                const msg = reason
                    ? await getString('erroruploadingdetail', 'mod_flexbook', {
                        file: file.name,
                        reason: reason || uploadStrings.createfailed,
                    })
                    : await getString('erroruploading', 'mod_flexbook', file.name);
                addNotification(msg, 'danger');
            }
            throw error;
        }
    };

    /**
     * Strip HTML from repository error payloads.
     *
     * @param {string} value
     * @return {string}
     */
    const stripHtml = (value) => {
        const node = document.createElement('div');
        node.innerHTML = String(value || '');
        return (node.textContent || node.innerText || '').trim();
    };

    /**
     * Extract a draft item id from a Moodle draftfile.php URL.
     *
     * @param {string} url
     * @return {number}
     */
    const extractDraftItemIdFromUrl = (url) => {
        const match = String(url || '').match(/\/draftfile\.php\/\d+\/user\/draft\/(\d+)\//);
        return match ? Number(match[1]) : 0;
    };

    /**
     * Normalise a draft upload JSON payload.
     *
     * @param {Object} result
     * @return {{itemid: number, url: string}}
     */
    const parseDraftUploadResult = (result) => {
        if (result.error) {
            throw new Error(stripHtml(result.error));
        }

        const url = result.url || '';
        let itemid = Number(result.itemid || 0);
        if (!itemid) {
            itemid = extractDraftItemIdFromUrl(url);
        }
        if (!itemid) {
            throw new Error(uploadStrings.serverconnection);
        }

        return {itemid, url};
    };

    /**
     * Human-readable upload failure reason from an XHR response.
     *
     * @param {XMLHttpRequest} xhr
     * @return {Error}
     */
    const draftUploadFailure = (xhr) => {
        if (xhr.responseText) {
            try {
                const payload = JSON.parse(xhr.responseText);
                if (payload.error) {
                    return new Error(stripHtml(payload.error));
                }
            } catch (e) {
                // Fall through to generic message below.
            }
        }
        if (xhr.status === 413) {
            return new Error(uploadStrings.uploadlimit);
        }
        const status = xhr.status || 0;
        if (status > 0) {
            return new Error(`${uploadStrings.serverconnection} (HTTP ${status})`);
        }
        return new Error(uploadStrings.serverconnection);
    };

    /**
     * Extract a message from upload-related errors (XHR, Ajax, validation).
     *
     * @param {Error|Object} error
     * @return {string}
     */
    const formatUploadErrorMessage = (error) => {
        if (!error) {
            return '';
        }
        if (typeof error.message === 'string' && error.message.trim() !== '') {
            return error.message.trim();
        }
        if (typeof error.error === 'string') {
            return stripHtml(error.error);
        }
        return '';
    };

    /**
     * Upload a file into the user draft area (multipart, Flexbook endpoint).
     *
     * @param {File} file
     * @return {Promise<{itemid: number, url: string}>}
     */
    const uploadFileToDraftArea = (file) => {
        const contextId = Number(state.config.contextid) || M.cfg.contextid;

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${M.cfg.wwwroot}/mod/flexbook/draftupload.php`, true);

            xhr.onload = () => {
                if (xhr.status !== 200) {
                    reject(draftUploadFailure(xhr));
                    return;
                }

                try {
                    resolve(parseDraftUploadResult(JSON.parse(xhr.responseText)));
                } catch (e) {
                    reject(e instanceof Error ? e : new Error(uploadStrings.serverconnection));
                }
            };

            xhr.onerror = () => {
                reject(new Error(uploadStrings.serverconnection));
            };

            const formData = new FormData();
            formData.append('file', file, file.name);
            formData.append('sesskey', M.cfg.sesskey);
            formData.append('contextid', String(contextId));

            xhr.send(formData);
        });
    };

    const showPluginSelectionModal = async(file, supportingPlugins, showApplyToAll = false) => {
        return new Promise((resolve) => {
            (async() => {
                const body = $('<div></div>');
                const label = await getString('selectinteractiontypefor', 'mod_flexbook', file.name);
                body.append($('<p></p>').text(label));
                const $list = $('<div class="list-group"></div>');

                let selectedPlugin = supportingPlugins[0];

                supportingPlugins.forEach((plugin, index) => {
                    let classes = 'list-group-item list-group-item-action d-flex align-items-center';
                    if (index === 0) {
                        classes += ' active';
                    }
                    const $item = $(`<a href="#" class="${classes}">
                        <i class="${plugin.icon} iv-mr-2 fs-20px"></i>
                        <span>${plugin.title}</span>
                    </a>`);
                    $item.on('click', (e) => {
                        e.preventDefault();
                        $list.find('.active').removeClass('active');
                        $item.addClass('active');
                        selectedPlugin = plugin;
                    });
                    $item.on('dblclick', (e) => {
                        e.preventDefault();
                        selectedPlugin = plugin;
                        resolveResult();
                    });
                    $list.append($item);
                });
                body.append($list);

                let $switch = null;
                if (showApplyToAll) {
                    $switch = $(`
                        <div class="form-check form-switch mt-3">
                            <input class="form-check-input" type="checkbox" role="switch" id="apply-to-all-switch">
                            <label class="form-check-label" for="apply-to-all-switch">
                                ${await getString('applytoall', 'mod_flexbook')}
                            </label>
                        </div>
                    `);
                    body.append($switch);
                }

                const proceedLabel = await getString('proceed', 'mod_flexbook');
                const cancelLabel = await getString('cancel', 'core');

                const modal = await ModalFactory.create({
                    title: await getString('selecttype', 'mod_flexbook'),
                    body: body,
                    footer: `
                        <button type="button" class="btn btn-primary" data-action="proceed">${proceedLabel}</button>
                        <button type="button" class="btn btn-secondary" data-action="hide">${cancelLabel}</button>
                    `
                });

                const resolveResult = () => {
                    const applyToAll = $switch ? $switch.find('#apply-to-all-switch').is(':checked') : false;
                    modal.hide();
                    resolve({
                        plugin: selectedPlugin,
                        applyToAll: applyToAll
                    });
                };

                modal.show();

                const root = modal.getRoot();
                root.on('click', '[data-action="proceed"]', (e) => {
                    e.preventDefault();
                    resolveResult();
                });

                root.on(ModalEvents.outsideClick, function(e) {
                    e.preventDefault();
                    root.addClass('jelly-anim');
                    setTimeout(() => {
                        root.removeClass('jelly-anim');
                    }, 500);
                });

                root.on(ModalEvents.shown, function() {
                    setTimeout(() => {
                        root.addClass('jelly-anim');
                        setTimeout(() => {
                            root.removeClass('jelly-anim');
                        }, 500);
                    }, 10);
                });

                modal.getRoot().on(ModalEvents.hidden, () => {
                    const applyToAll = $switch ? $switch.find('#apply-to-all-switch').is(':checked') : false;
                    // If we haven't resolved yet (e.g. closed via cancel or X), resolve with null plugin.
                    setTimeout(() => resolve({
                        plugin: null,
                        applyToAll: applyToAll
                    }), 100);
                });
            })();
        });
    };
};


export default {
    /**
     * Initialize function on page loads.
     * @param {string} cmid course module id
     * @param {number} flexbook instance id
     * @param {number} courseid course id
     * @param {number} coursecontextid course context id
     * @param {number} userid user id
     * @param {string} extendedcompletion extended completion
     */
    init: init,
};
