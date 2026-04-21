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

    // Implement more actions.
    $(document).on('click', 'tr.annotation .more-actions', async function(e) {
        e.preventDefault();
        const $wrapper = $(this).closest('.btns');
        const $menu = $moreactionsmenu.clone();
        $menu.removeClass('d-none').addClass('show');
        $wrapper.append($menu);
        $(document).one('click', function(e) {
            e.preventDefault();
            $menu.remove();
        });
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
            // Add the new annotation before the beforeItem or at the end.
            if (beforeItem) {
                annotations.splice(annotations.findIndex(x => x.id == beforeItem), 0, updated);
            } else {
                annotations.push(updated);
            }
            if (action == 'add') {
                activeid = updated.id;
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
            saveDraft();
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
        window.console.log(e.originalEvent.detail.annotation);
        // Remove any tooltips that may be open.
        $('.tooltip').remove();
        const annotation = e.originalEvent.detail.annotation;
        activeid = null;
        $annotationlist.find(`tr[data-id="${annotation.id}"]`).addClass('deleted');
        saveDraft();
        setTimeout(async function() {
            annotations = annotations.filter(function(item) {
                return item.id != annotation.id;
            });
            renderAnnotationItems(annotations);
            addNotification(await getString('interactiondeleted', 'mod_interactivevideo'), 'success');
        }, 1000);
        if ($($('#annotation-list-bulk-edit')).hasClass('active')) {
            $('#annotation-list-bulk-edit').trigger('click');
        }
    });

    const saveDraft = async() => {
        // Get the current sequence based on the tr data-id.
        const trarray = $annotationlist.find('tr[data-id]').map(function() {
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

    // Select by ctrl + click.
    $annotationlist.find('tr').on('click', function(e) {
        if (e.ctrlKey) {
            $(this).toggleClass('b-active');
        }
    });
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