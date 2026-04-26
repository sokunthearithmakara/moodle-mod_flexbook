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
import {safeParse} from './utils';
import state from './state';

const addNotification = (msg, type = "info") => {
    addToast(msg, {
        type: type
    });
};

const init = async(
    cmid,
    flexbook,
    courseid,
    coursecontextid,
    userid,
    extendedcompletion = null,
) => {
    state.config = {
        cmid,
        flexbook,
        courseid,
        coursecontextid,
        userid,
        extendedcompletion,
        isEditMode: true
    };

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
    let sequence = $('#sequence').text().split(',');

    let doptions = safeParse($('#doptions').text(), {});
    let contentTypes = safeParse($('#contenttypes').text(), {});
    let annotations = safeParse($('#items').text(), []);

    let ctRenderer = {};
    window.console.log({doptions, contentTypes, annotations});

    // Remove all annotations that are not in the enabled content types.
    annotations = annotations.filter(x => contentTypes.find(y => y.name === x.type));

    if (annotations.length == 0) {
        let html = `<button class="btn btn-primary btn-rounded" id="addinteractionbtn">
        <i class="fa fa-plus" aria-hidden="true"></i> `;
        html += await getString('add', 'mod_interactivevideo');
        html += '</button>';
        $annotationlist.html(html)
            .addClass("d-flex align-items-center justify-content-center");
    }

    // Order the annotations by sequence.
    annotations = sequence.map(x => annotations.find(y => y.id == x));
    annotations = annotations.filter(x => x); // Remove null values.

    annotations = annotations.map(x => {
        x.prop = JSON.stringify(contentTypes.find(y => y.name === x.type));
        return x;
    });

    let activeid = null; // Current active annotation id. Mainly used when editing to relaunch the interaction afte editing.

    /**
     * Handle rendering of annotation items on the list
     * @param {Array} annotations array of annotation objects
     * @returns
     */
    const renderAnnotationItems = async(annotations) => {
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
            } catch (e) {
                window.console.error(e, item);
            }
        });

        let xp = annotations.filter(x => x.xp).map(x => Number(x.xp)).reduce((a, b) => a + b, 0);
        $("#xp span").text(xp);

        if (activeid) {
            const activeAnno = annotations.find(x => x.id == activeid);
            if (activeAnno) {
                ctRenderer[activeAnno.type].postEditCallback(activeAnno);
            }
        }
    };

    // Sortable. Note that if the sorting item is b-active, we're moving all the b-active items.
    $('#annotation-list').sortable({
        handle: '.handle',
        cursor: 'move',
        items: '.listItem',
        placeholder: "ui-state-highlight",
        start: function(e, ui) {
            if (ui.item.hasClass('b-active')) {
                // Hide sibling selected rows immediately so only the combined
                // helper is visible — gives a smooth "moving all rows" feel.
                ui.item.siblings('tr.b-active').css({opacity: '0', pointerEvents: 'none'});
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
                const selecteditems = item.parent().find('tr.b-active');
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
            // Sync the annotations array to the new DOM order so that a
            // subsequent renderAnnotationItems() call (e.g. after an add/clone)
            // does not rebuild the list from the old order and undo the drag.
            const newOrder = $annotationlist.find('tr[data-id]').not('.deleted').map(function() {
                return $(this).data('id');
            }).get();
            annotations = newOrder.map(id => annotations.find(x => x.id == id)).filter(x => x);
        },
        helper: function(e, item) {
            if (!item.hasClass('b-active')) {
                return item;
            }

            const selecteditems = item.parent().find('tr.b-active');

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

    // Recompute and refresh the toolbar based on current selection.
    const syncBulkToolbar = () => {
        const count = $annotationlist.find('tr.b-active').length;
        if (count > 0) {
            showBulkToolbar(count);
        } else {
            hideBulkToolbar();
        }
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
                ctRenderer[contentType.name] = new Type(annotations, contentType);
                resolve();
            });
        });
    }));

    await Promise.all(initContentTypes);

    renderAnnotationItems(annotations);

    let ModalFactory;
    if (window.M.version >= 403) {
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
            backdrop: 'static',
            removeOnHide: false,
        });
        let root = contentTypeModal.getRoot();
        let $body = $('#contentmodal-original .modal-content').html();
        root.attr('id', 'contentmodal');
        root.find('.modal-dialog .modal-content').html($body);
        contentTypeModal.show();

        root.on(ModalEvents.hidden, function() {
            $('#addcontentdropdown .dropdown-item').removeClass('active');
        });

        root.on(ModalEvents.shown, function() {
            // Apply jelly animation after DOM is ready
            setTimeout(() => {
                root.addClass('jelly-anim');
            }, 10);

            // Make the modal draggable.
            root.find('.modal-dialog').draggable({
                handle: ".modal-header"
            });
        });

        root.on('click', '.modal-header [type="button"]', function() {
            contentTypeModal.hide();
        });

        root.on('click', '.dropdown-item', function() {
            root.removeClass('jelly-anim');
            contentTypeModal.hide();
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

        if (!anchorid) {
            return;
        }

        const files = e.originalEvent.clipboardData.files;
        if (files.length > 0) {
            e.preventDefault();
            await handleFileDrop(files, anchorid);
            // Dismiss selection and toolbar.
            $annotationlist.find('tr.b-active').removeClass('b-active');
            hideBulkToolbar();

            if (navigator.clipboard.writeText) {
                await navigator.clipboard.writeText('');
            }
        }
    });

    // Implement view annotation.
    $(document).on('click', 'tr.annotation .title', async function(e) {
        e.preventDefault();
        const id = $(this).closest('.annotation').data('id');
        const theAnnotation = annotations.find(annotation => annotation.id == id);
        ctRenderer[theAnnotation.type].previewInteraction(theAnnotation);
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
                }
            }])[0];
            const updated = safeParse(anno.data, {});
            dispatchEvent('annotationupdated', {
                annotation: updated,
                action: 'edit'
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

        if (action == 'add' || action == 'clone') {
            const anchorid = e.originalEvent.detail.anchorid;
            const isDnD = e.originalEvent.detail.isDnD;
            // Add the new annotation after the anchorid, before the beforeItem, or at the end.
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
            if (action == 'add') {
                if (!isDnD) {
                    activeid = updated.id;
                }
            } else {
                // Clone: do NOT auto-preview the duplicated item.
                activeid = null;
            }
        } else {
            activeid = null;
        }
        annotations.map(x => {
            x.editMode = true;
            return x;
        });
        renderAnnotationItems(annotations);
        if (action == 'add' || action == 'clone') {
            addNotification(await getString('interactionadded', 'mod_interactivevideo'), 'success');
            const addResult = await saveDraft();
            if (addResult.status != 'success') {
                addNotification(await getString('anerroroccured', 'mod_flexbook'), 'danger');
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
        const annotation = e.originalEvent.detail.annotation;
        activeid = null;
        $annotationlist.find(`tr[data-id="${annotation.id}"]`).addClass('deleted');
        syncBulkToolbar(); // Recount in case the deleted row was selected.
        setTimeout(async function() {
            annotations = annotations.filter(function(item) {
                return item.id != annotation.id;
            });
            renderAnnotationItems(annotations);
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



    // Deselect all rows when the user clicks outside #content-region.
    $(document).on('click', function(e) {
        if (!$(e.target).closest('#content-region').length) {
            $annotationlist.find('tr.b-active').removeClass('b-active');
            hideBulkToolbar();
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
            // Visually mark rows as being removed.
            $selected.addClass('deleted');
            hideBulkToolbar();
            activeid = null;

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

            // Remove successfully deleted IDs from the annotations array.
            const deletedSet = new Set(ids.map(String));
            annotations = annotations.filter(a => !deletedSet.has(String(a.id)));

            // Wait for the fade-out animation, then re-render and persist.
            setTimeout(async function() {
                renderAnnotationItems(annotations);
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
                .catch(() => {});
        } catch {
            Notification.saveCancel(title, body, button, doDelete);
        }
    });

    // Bulk toolbar: clone button.
    $(document).on('click', '#bulk-clone-btn', async function() {
        const $selected = $annotationlist.find('tr.b-active');
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

    // Warn before leaving the page if there are unsaved changes.
    window.addEventListener('beforeunload', (e) => {
        if (!$('#savedraft').is(':disabled')) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    // ── Drag and Drop Files ─────────────────────────────────────────────────
    const $dropZone = $('#contentblock');
    let dragCounter = 0;

    $dropZone.on('dragenter', function(e) {
        e.preventDefault();
        e.stopPropagation();
        dragCounter++;
        $(this).addClass('dragover');
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
    });

    // Handle dragover on specific items for insertion.
    $annotationlist.on('dragover dragenter', 'tr[data-id]', function() {
        $(this).addClass('dnd-target');
    });

    $annotationlist.on('dragleave dragend drop', 'tr[data-id]', function() {
        $(this).removeClass('dnd-target');
    });

    const handleFileDrop = async(files, anchorid = null) => {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const ext = file.name.split('.').pop().toLowerCase();
            const supportingPlugins = contentTypes.filter(ct => {
                return ct.dndextensions && ct.dndextensions.includes(ext);
            });

            if (supportingPlugins.length === 0) {
                addNotification(await getString('unsupportedfiletype', 'mod_flexbook', file.name), 'warning');
                continue;
            }

            let selectedPlugin = supportingPlugins[0];
            if (supportingPlugins.length > 1) {
                selectedPlugin = await showPluginSelectionModal(file, supportingPlugins);
                if (!selectedPlugin) {
                    continue;
                }
            }

            await processFileUpload(file, selectedPlugin, anchorid);
        }
    };

    const processFileUpload = async(file, plugin, anchorid = null) => {
        addNotification(await getString('uploading', 'mod_flexbook', file.name), 'info');

        try {
            let response = null;
            if (plugin.name === 'richtext') {
                const content = await file.text();
                response = {content: content};
            } else {
                const draftitemid = await uploadFileToDraftArea(file);
                response = {draftitemid: draftitemid};
            }

            if (ctRenderer[plugin.name] && typeof ctRenderer[plugin.name].dnd === 'function') {
                await ctRenderer[plugin.name].dnd(annotations, file, response, anchorid);
            } else {
                // Fallback.
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
                        anchorid: anchorid || 0
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
            window.console.error(error);
            addNotification(await getString('erroruploading', 'mod_flexbook', file.name), 'danger');
        }
    };

    const uploadFileToDraftArea = async(file) => {
        const reader = new FileReader();
        return new Promise((resolve, reject) => {
            reader.onload = async() => {
                const base64Content = reader.result.split(',')[1];
                try {
                    const result = await Ajax.call([{
                        methodname: 'mod_flexbook_upload_file',
                        args: {
                            contextid: M.cfg.contextid,
                            filename: file.name,
                            filecontent: base64Content
                        }
                    }])[0];
                    resolve(parseInt(result.data));
                } catch (e) {
                    reject(e);
                }
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const showPluginSelectionModal = async(file, supportingPlugins) => {
        return new Promise((resolve) => {
            (async() => {
                const body = $('<div></div>');
                body.append($('<p></p>').text(await getString('selectinteractiontypefor', 'mod_flexbook', file.name)));
                const $list = $('<div class="list-group"></div>');

                supportingPlugins.forEach(plugin => {
                    const $item = $(`<a href="#" class="list-group-item list-group-item-action d-flex align-items-center">
                        <i class="${plugin.icon} iv-mr-2 fs-20px"></i>
                        <span>${plugin.title}</span>
                    </a>`);
                    $item.on('click', (e) => {
                        e.preventDefault();
                        modal.hide();
                        resolve(plugin);
                    });
                    $list.append($item);
                });
                body.append($list);

                const modal = await ModalFactory.create({
                    title: await getString('selecttype', 'mod_flexbook'),
                    body: body,
                    buttons: {
                        cancel: await getString('cancel', 'core'),
                    }
                });
                modal.show();
                modal.getRoot().on(ModalEvents.hidden, () => resolve(null));
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