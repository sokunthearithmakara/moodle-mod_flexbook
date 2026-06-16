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
 * Base class for all interaction types.
 *
 * @module     mod_flexbook/type/base
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import $ from 'jquery';
import {dispatchEvent} from 'core/event_dispatcher';
import {add as addToast} from 'mod_flexbook/toast';
import ModalForm from 'core_form/modalform';
import 'mod_interactivevideo/libraries/jquery-ui';
import {get_string as getString} from 'core/str';
import Fragment from 'core/fragment';
import ModalEvents from 'core/modal_events';
import Ajax from 'core/ajax';
import Templates from 'core/templates';
import state from '../state';
import {safeParse, getMoodleVersion, formatContent as formatFlexbookContent} from '../utils';
import {shouldShowInstructions} from '../instructions';
import {notifyFilterContentUpdated as notifyFilter} from 'core_filters/events';

/**
 * Whether the current page is an IV/Flexbook completion report.
 *
 * @returns {boolean}
 */
const isReportPage = () => {
    if (state.config?.isReportMode === true) {
        return true;
    }
    const bodyId = document.body?.id || '';
    return bodyId === 'page-mod-flexbook-report'
        || bodyId === 'page-mod-interactivevideo-report';
};

/**
 * Build serialisable log field payload for mod_flexbook_save_log.
 *
 * @param {Object} data Log input data.
 * @param {number} completionid Fallback completion id.
 * @returns {Object}
 */
const buildSaveLogPayload = (data, completionid) => {
    const payload = {};
    for (let i = 1; i <= 6; i++) {
        payload['text' + i] = data['text' + i] || '';
        payload['char' + i] = data['char' + i] || '';
        payload['intg' + i] = data['intg' + i] || 0;
    }
    payload.completionid = data.completionid || completionid || 0;
    return payload;
};

export default class Base {
    /**
     * Creates an instance of the base class for interactive video.
     *
     * @param {Array} annotations - The annotations object.
     * @param {Object} properties - Properties of the interaction type defined in the PHP class.
     *
     */
    constructor(annotations, properties) {
        /**
         * Access token
         * @type {string}
         * @private
         */
        this.token = state.config.token;

        /**
         * The course module id
         * @type {number}
         * @private
         */
        this.cm = state.config.cmid;

        /**
         * The annotations object
         * @type {Array}
         * @private
         */
        this.annotations = annotations;
        /**
         * The interaction id
         * @type {number}
         * @private
         */
        this.flexbook = state.config.flexbook;
        /**
         * The course id
         * @type {number}
         * @private
         */
        this.course = state.config.courseid;
        /**
         * The user id
         * @type {number}
         * @private
         */
        this.userid = state.config.userid;
        /**
         * The required completion percentage set in the activity settings
         * @type {number}
         * @private
         */
        this.completionpercentage = state.config.completionpercentage;
        /**
         * The grade item instance id
         * @type {number}
         * @private
         */
        this.gradeiteminstance = state.config.gradeiteminstance;
        /**
         * The maximum grade set in the activity settings
         * @type {number}
         * @private
         */
        this.grademax = state.config.grademax;
        /**
         * Properties of the interaction type defined in the php class
         * @type {Object}
         * @private
         */
        this.prop = properties;
        /**
         * Display options
         * @type {Object}
         * @private
         */
        this.displayoptions = safeParse($('#doptions').text(), {});
        /**
         * Completion id
         * @type {number}
         */
        this.completionid = Number(state.config.completionid || 0);
        /**
         * Extra completion
         * @type {Object}
         */
        this.extracompletion = state.config.extendedcompletion ? safeParse(state.config.extendedcompletion, {}) : {};

        /**
         * Additional options
         */
        this.options = {
            isEditMode: state.config.isEditMode,
            isPreviewMode: state.config.isPreviewMode,
            isEmbedMode: state.config.isEmbedMode,
            isCompleted: state.config.isCompleted,
            isGuest: state.config.isGuest
        };

        /**
         * Cache the annotations
         * @type {Object}
         */
        this.cache = {};

        /**
         * Is bs-5.
         * @type {boolean}
         */
        this.isBS5 = $('body').hasClass('bs-5');

        this.rtl = $('body').hasClass('dir-rtl');

        /**
         * Is the main video or sub video in multiple track situation.
         * @type {boolean}
         */
        this.main = true;
    }

    /**
     * Edit annotation
     * @param {Array} annotations array of annotations
     * @param {number} id the id of the annotation to edit
     * @returns {Promise}
     */
    async linkedEdit(annotations, id) {
        this.editAnnotation(annotations, id);
    }

    /**
     * Dispatch an event
     * @param {string} name The event name
     * @param {Object} detail The event detail
     * @returns {void}
     */
    dispatchEvent(name, detail) {
        dispatchEvent(name, detail);
    }

    /**
     * Notify filter of updated content.
     * @param {HTMLElement} element - The element to notify.
     */
    notifyFilterContentUpdated(element) {
        notifyFilter(element);
    }

    /**
     * Enable the HTML5 color picker in form elements
     * @returns {void}
     */
    enableColorPicker() {
        $(document).on('input', 'input[type="color"]', function() {
            const color = $(this).val();
            $(this).closest('.color-picker').css('background-color', color);
            $(this).closest('.fitem').find('input[type="text"]').val(color);
        });
    }

    async addNotification(msg, type = 'danger', emoji = null) {
        const data = {type};
        if (emoji) {
            data.emoji = emoji;
        }
        addToast(msg, data);
    }

    async formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor(seconds % 3600 / 60);
        const s = Math.floor(seconds % 3600 % 60);
        return (h > 0 ? h + ':' : '') + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }

    init() {
        // Do nothing.
    }

    /**
     * Render edit items
     * @param {Array} annotations The annotations array
     * @param {Object} listItem The list item
     * @param {Object} item The annotation object
     * @returns {void}
     */
    renderEditItem(annotations, listItem, item) {
        this.annotations = annotations;
        listItem.removeAttr('id').removeClass('d-none');
        listItem.attr({
            'data-type': item.type,
            'data-id': item.id,
        });
        listItem.addClass(item.type);

        listItem.find('.title').html(item.formattedtitle);
        if (item.hascompletion == 1) {
            listItem.find('.btn.xp span').text(Number(item.xp));
            listItem.attr('data-xp', Number(item.xp));
        } else {
            listItem.find('.btn.xp').remove();
        }

        listItem.find('.type-icon i').addClass(this.prop.icon);
        listItem.find('.type-icon').attr('title', this.prop.title);

        listItem.find('[data-field]').attr('data-id', item.id);
        listItem.find('[data-field="xp"]').val(Number(item.xp));
        listItem.find('[data-field="title"]').val(item.title);
        if (!this.prop.allowmultiple) {
            listItem.find('.btn.copy').remove();
            listItem.find('.title').addClass('text-dark no-pointer').removeClass('text-primary text-secondary cursor-pointer');
        }
        listItem.appendTo('#annotation-list');
        return listItem;
    }

    /**
     * Add an annotation
     * @param {Array} annotations The annotations array
     * @returns {void}
     */
    addAnnotation(annotations) {
        let self = this;

        // Rewrite annotations to class.
        this.annotations = annotations;

        const data = {
            id: 0,
            timestamp: 0,
            title: self.prop.title,
            contextid: M.cfg.contextid,
            type: self.prop.name,
            courseid: self.course,
            cmid: self.cm,
            annotationid: self.flexbook,
            hascompletion: self.prop.hascompletion ? 1 : 0,
            annotations: JSON.stringify(this.annotations),
        };

        const form = new ModalForm({
            formClass: self.prop.fbform,
            args: data,
            modalConfig: {
                title: M.util.get_string('addinteractiontitle', 'mod_flexbook', {
                    "name": self.prop.title.toLowerCase(),
                }),
            }
        });
        form.show();

        const onEditFormLoaded = (e) => {
            // Wait for the form to be loaded.
            try {
                (function waitForForm() {
                    const formElement = form.modal.modal.find('form');
                    if (formElement.length) {
                        self.onEditFormLoaded(form, e);
                    } else {
                        requestAnimationFrame(waitForForm);
                    }
                })();
            } catch (error) {
                // Do nothing.
            }
        };

        form.addEventListener(form.events.LOADED, (e) => {
            setTimeout(() => {
                $('body').addClass('modal-open');
            }, 500);
            onEditFormLoaded(e);

            // Make form draggable.
            form.modal.modal.draggable({
                handle: ".modal-header"
            });
        });

        // We must reinitialize js after the form has validation errors.
        form.addEventListener(form.events.SERVER_VALIDATION_ERROR, (e) => {
            onEditFormLoaded(e);
        });

        form.addEventListener(form.events.CLIENT_VALIDATION_ERROR, (e) => {
            onEditFormLoaded(e);
        });

        form.addEventListener(form.events.FORM_SUBMITTED, (e) => {
            e.stopImmediatePropagation();
            dispatchEvent('annotationupdated', {
                annotation: e.detail,
                action: 'add'
            });
        });
    }

    /**
     * Edit an annotation
     * @param {Array} annotations The annotations array
     * @param {number} id The annotation id
     * @returns {void}
     */
    async editAnnotation(annotations, id) {
        this.annotations = annotations;
        let self = this;
        const annotation = annotations.find(x => x.id == id);
        annotation.contextid = M.cfg.contextid;
        annotation.annotations = JSON.stringify(this.annotations);

        const modalTitle = await getString('editinteractiontitle', 'mod_flexbook', {
            'name': annotation.formattedtitle,
        });

        const form = new ModalForm({
            formClass: this.prop.fbform,
            args: annotation,
            modalConfig: {
                title: modalTitle,
            }
        });

        form.show();

        const onEditFormLoaded = (e) => {
            // Wait for the form to be loaded.
            try {
                (function waitForForm() {
                    const formElement = form.modal.modal.find('form');
                    if (formElement.length) {
                        self.onEditFormLoaded(form, e);
                    } else {
                        requestAnimationFrame(waitForForm);
                    }
                })();
            } catch (error) {
                // Do nothing.
            }
        };

        form.addEventListener(form.events.LOADED, (e) => {
            onEditFormLoaded(e);
            // Make form draggable.
            form.modal.modal.draggable({
                handle: ".modal-header"
            });
        });

        // We must reinitialize js after the form has validation errors.
        form.addEventListener(form.events.SERVER_VALIDATION_ERROR, (e) => {
            onEditFormLoaded(e);
        });

        form.addEventListener(form.events.CLIENT_VALIDATION_ERROR, (e) => {
            onEditFormLoaded(e);
        });

        form.addEventListener(form.events.FORM_SUBMITTED, (e) => {
            e.stopImmediatePropagation();
            this.annotations = this.annotations.filter(x => x.id != id);
            dispatchEvent('annotationupdated', {
                annotation: e.detail,
                action: 'edit'
            });
        });
    }

    /**
     * Copy an annotation
     * @param {number} id The annotation id
     * @returns {void}
     */
    async cloneAnnotation(id) {
        let result = await Ajax.call([{
            methodname: 'mod_flexbook_duplicate',
            args: {
                contextid: M.cfg.contextid,
                id: id,
            }
        }])[0];

        if (result.status != 'success') {
            this.addNotification(await getString('anerroroccured', 'mod_flexbook'), 'danger');
            return;
        }
        const newAnnotation = safeParse(result.data, {});
        dispatchEvent('annotationupdated', {
            annotation: newAnnotation,
            action: 'clone'
        });
    }

    /**
     * Delete an annotation
     * @param {Array} annotations The annotations array
     * @param {number} id The annotation id
     * @returns {void}
     */
    async deleteAnnotation(annotations, id) {
        this.annotations = annotations;
        let result = await Ajax.call([{
            methodname: 'mod_flexbook_delete',
            args: {
                contextid: M.cfg.contextid,
                id: id,
                cmid: this.cm,
            }
        }])[0];

        if (result.status != 'success') {
            this.addNotification(await getString('anerroroccured', 'mod_flexbook'), 'danger');
            return;
        }
        dispatchEvent('annotationdeleted', {
            annotation: this.annotations.find(x => x.id == id),
            action: 'delete'
        });
    }

    /**
     * Build header action dropdown and instructions toggle for player mode.
     *
     * @param {Object} annotation
     * @param {boolean} isPlayerMode
     * @returns {Promise<Object>}
     */
    async buildHeaderChrome(annotation, isPlayerMode) {
        const settings = safeParse(annotation.advanced, {});
        let showdelete = false;
        if (settings.deletebeforecomplete == 1 || settings.deleteaftercomplete == 1) {
            showdelete = true;
        }
        if (annotation.hascompletion == 0 || annotation.completiontracking == 'manual' || annotation.completiontracking == 'none') {
            showdelete = false;
        }
        annotation.activitycomplete = this.options.isCompleted ? 1 : 0;
        const candelete = annotation.completed == true && (
            (annotation.activitycomplete == 1 && settings.deleteaftercomplete == 1) ||
            (annotation.activitycomplete == 0 && settings.deletebeforecomplete == 1)
        );

        const bs = this.isBS5 ? '-bs' : '';
        let headeractions = '';
        if (isPlayerMode) {
            headeractions = await Templates.render('mod_flexbook/canvas/headeractions', {
                id: annotation.id,
                iseditor: state.config.iseditor,
                editurl: M.cfg.wwwroot + '/mod/flexbook/interactions.php?id=' + this.cm + '&aid=' + annotation.id,
                showdelete,
                candelete,
                isPlayerMode: true,
                bs,
            });
        }

        const showinstructions = shouldShowInstructions(annotation);
        const instructionstoggle = showinstructions
            ? await Templates.render('mod_flexbook/canvas/instructionstoggle', {id: annotation.id, bs})
            : '';

        return {headeractions, instructionstoggle, showinstructions, showdelete, candelete};
    }

    async renderMessageTitle(annotation, playermode = false) {
        let self = this;
        let props = safeParse(annotation.prop, {});

        if (!playermode) {
            const bs = this.isBS5 ? '-bs' : '';
            const showinstructions = shouldShowInstructions(annotation);
            const instructionstoggle = showinstructions
                ? await Templates.render('mod_flexbook/canvas/instructionstoggle', {id: annotation.id, bs})
                : '';
            let $title = await Templates.render('mod_flexbook/messagetitle', {
                id: annotation.id,
                title: annotation.formattedtitle,
                icon: props.icon || 'bi bi-info-circle',
                showinstructions,
                instructionstoggle,
                bs,
            });
            return $title;
        }

        let completionbutton = "";
        if (annotation.hascompletion == 1 && annotation.xp > 0) {
            if (Number(annotation.earned) % 1 != 0) {
                annotation.earned = Math.round(Number(annotation.earned) * 100) / 100;
            } else {
                annotation.earned = Number(annotation.earned);
            }
            let earned = annotation.completed ? annotation.xp : annotation.earned + '/' + annotation.xp;
            completionbutton += `<span class="badge ${annotation.completed ? 'alert-success' : 'iv-badge-secondary'} iv-mr-2">
        ${annotation.completed ? earned : Number(annotation.xp)} XP</span>`;
        }

        completionbutton += await Templates.render('mod_flexbook/canvas/completionbutton', {
            id: annotation.id,
            manual: annotation.completiontracking == 'manual',
            iscompleted: annotation.completed,
            isPlayerMode: true,
            refreshonly: (annotation.hascompletion != 1) || self.isEditMode(),
            iseditor: state.config.iseditor,
            editurl: M.cfg.wwwroot + '/mod/flexbook/interactions.php?id=' + this.cm + '&aid=' + annotation.id
        });

        const chrome = await self.buildHeaderChrome(annotation, true);

        let $title = await Templates.render('mod_flexbook/messagetitle', {
            id: annotation.id,
            title: annotation.formattedtitle,
            icon: props.icon || 'bi bi-info-circle',
            completionbutton: completionbutton,
            headeractions: chrome.headeractions,
            instructionstoggle: chrome.instructionstoggle,
            showinstructions: chrome.showinstructions,
        });
        return $title;
    }

    /**
     * Play the jelly entrance/deny animation on a modal root.
     *
     * @param {jQuery} root Modal root element.
     * @param {Number} [delayMs=10] Delay before starting animation.
     * @return {void}
     */
    playJellyAnim(root, delayMs = 10) {
        setTimeout(() => {
            root.addClass('jelly-anim');
            setTimeout(() => {
                root.removeClass('jelly-anim');
            }, 500);
        }, delayMs);
    }

    async createModal(annotation, playermode = false) {
        const self = this;
        const found = this.annotations.find(x => x.id == annotation.id);
        if (found) {
            annotation = found;
        }

        let ModalFactory;
        if (getMoodleVersion() >= 403 || $('body').hasClass('bs-5')) {
            ModalFactory = await import('core/modal');
        } else {
            ModalFactory = await import('core/modal_factory');
        }

        let modal = await ModalFactory.create({
            title: '',
            large: true,
            body: '',
            removeOnClose: true,
            isVerticallyCentered: true,
        });

        return new Promise((resolve) => {
            let root = modal.getRoot();
            root.attr('id', 'annotation-modal');
            root.find('.modal-dialog')
            .attr({
                'data-id': annotation?.id,
                'data-placement': 'popup',
                'id': 'message'
            })
            .addClass('active ' + annotation?.type);
            modal.show();
            root.data('modal', modal);

            // Enable draggable.
            this.setModalDraggable('#annotation-modal .modal-dialog');

            root.find('#message').on('click', '#close-' + annotation?.id, function() {
                root.attr('data-region', 'modal-container');
                root.fadeOut(300, function() {
                    modal.hide();
                });
            });

            if (playermode) {
                root.find('#message').on('click', '[data-action="refresh"]', function(e) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    $(this).find('i').addClass('fa-spin');

                    delete self.cache[annotation.id];

                    setTimeout(function() {
                        modal.hide();
                        self.launchModalInteraction(annotation);
                    }, 1000);
                });
            }

            root.on(ModalEvents.hidden, function() {
                $('#annotation-modal').remove();
                modal.destroy();
            });

            root.on(ModalEvents.outsideClick, function(e) {
                e.preventDefault();
                self.playJellyAnim(root, 0);
            });

            root.on(ModalEvents.shown, async() => {
                self.playJellyAnim(root);
                if (annotation) {
                    const settings = safeParse(annotation.advanced, {});
                    const hideHeader = !isReportPage() && settings.hideheader == 1;
                    const $message = root.find('#message');
                    $message.toggleClass('header-hidden', hideHeader);
                    const $title = root.find('.modal-header').attr('id', 'title');
                    $title.removeClass('shadow-sm hide-header bottom-header');
                    if (hideHeader) {
                        $title.addClass('hide-header');
                    } else {
                        $title.addClass('shadow-sm');
                    }
                    if (settings.bottomheader == 1) {
                        $title.addClass('bottom-header');
                    }
                    $title.html(await this.renderMessageTitle(annotation, playermode));
                }
                resolve(root);
            });
        });
    }

    async previewInteraction(annotation, log) {
        let self = this;

        let root = await this.createModal(annotation);
        const $message = root.find(`#message[data-id="${annotation.id}"]`);
        await self.applyContent(annotation, $message, log);
    }

    /**
     * Resolve a navigation id to a flexbook_items annotation for embed preview.
     *
     * @param {string|number} id Target id or navigation special.
     * @return {Promise<Object|null>}
     */
    async resolveEmbedNavigationAnnotation(id) {
        let resolvedId = id;
        const sequence = state.sequence || [];
        const annotations = this.annotations || state.annotations || [];
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

        return annotations.find((item) => String(item.id) === String(resolvedId)) || null;
    }

    /**
     * Preview another interaction via embed.php inside the standard Flexbook modal shell.
     *
     * Used from edit mode (Ctrl+click) so the target runs in player/preview mode without
     * mutating the current interaction's authoring UI.
     *
     * @param {string|number} id Target id or navigation special.
     * @return {Promise<boolean>}
     */
    async previewEmbedInteraction(id) {
        const annotation = await this.resolveEmbedNavigationAnnotation(id);
        if (!annotation) {
            return false;
        }

        if (this._embedPreviewCleanup) {
            this._embedPreviewCleanup();
            this._embedPreviewCleanup = null;
        }

        $('#annotation-modal').remove();

        const previewAnno = Object.assign({}, annotation, {
            formattedtitle: annotation.formattedtitle || annotation.title || '',
        });

        const root = await this.createModal(previewAnno, false);
        const $message = root.find('#message');
        $message.removeClass('modal-lg').addClass('modal-xl hasiframe');

        const embedUrl = new URL(`${M.cfg.wwwroot}/mod/flexbook/embed.php`);
        embedUrl.searchParams.set('id', String(annotation.id));
        if (state.config.darkmode || $('body').hasClass('darkmode')) {
            embedUrl.searchParams.set('dm', '1');
        }

        const iframeId = `fb-embed-preview-${annotation.id}`;
        const iframeTitle = previewAnno.formattedtitle;
        const $content = $message.find('.modal-body').attr('id', 'content').addClass('p-0');
        $content.html(
            '<div class="preview-iframe w-100">'
            + `<iframe id="${iframeId}" src="${embedUrl}" title="${iframeTitle.replace(/"/g, '&quot;')}" `
            + 'allowfullscreen></iframe>'
            + '</div>'
        );

        const embedParent = (await import('mod_flexbook/embed_parent')).default;
        this._embedPreviewCleanup = embedParent.init(`#${iframeId}`, {minHeight: 480});

        root.on(ModalEvents.hidden, () => {
            if (this._embedPreviewCleanup) {
                this._embedPreviewCleanup();
                this._embedPreviewCleanup = null;
            }
        });

        return true;
    }

    async launchModalInteraction(annotation, log) {
        let self = this;

        // 1. Backup background state
        const previousAnno = state.currentanno;

        // 2. Switch context to the target interaction
        state.currentanno = annotation;

        // 3. Dispatch interactionrun for the target modal interaction
        dispatchEvent('interactionrun', {annotation: annotation});

        // 4. Create the modal in player mode!
        let root = await this.createModal(annotation, true);

        const modal = root.data('modal');
        if (modal) {
            root.off(ModalEvents.hidden).on(ModalEvents.hidden, function() {
                $('#annotation-modal').remove();
                modal.destroy();

                // 5. Dispatch closing events for target cleanup and canvas disposal
                if (annotation && annotation.id) {
                    dispatchEvent('interactionclose', {annotation: annotation});
                    dispatchEvent('interactionrefresh', {annotation: annotation});
                }

                // 6. Restore background interaction context
                if (previousAnno) {
                    state.currentanno = previousAnno;
                    dispatchEvent('interactionrun', {annotation: previousAnno});

                    const bgRenderer = state.ctRenderer[previousAnno.type];
                    if (bgRenderer && typeof bgRenderer.activatePlayerBoardContext === 'function') {
                        bgRenderer.activatePlayerBoardContext(previousAnno.id);
                    }
                }
            });
        }

        const $message = root.find(`#message[data-id="${annotation.id}"]`);
        await self.applyContent(annotation, $message, log);

        // 7. Set up manual completion bindings for popup modal interaction if applicable
        if (annotation.hascompletion == 1 && annotation.completiontracking == 'manual') {
            this.enableManualCompletion(annotation);
        }
    }

    async postContentRender() {
        // Do nothing.
        return;
    }

    /**
     * Render a standalone embedded interaction (no header, no completion UI).
     *
     * @param {Object} annotation The annotation object.
     * @param {JQuery} $wrapper The wrapper element.
     * @returns {Promise<void>}
     */
    async runEmbedInteraction(annotation, $wrapper) {
        const $host = $wrapper.find('[data-fb-embed-target]').first();
        const $stage = $host.length ? $host : $wrapper;
        const $message = await this.handleInlineDisplay(annotation, '', $stage);
        await this.applyContent(annotation, $message);
        $message.addClass('active show');
    }


    // eslint-disable-next-line complexity
    async runInteraction(annotation, $wrapper) {
        let self = this;
        let $annotationcontent = $wrapper.find('#annotation-canvas');
        // Add completion button if the annotation has completion criteria.
        let completionbutton = "";
        // Display the xp badge conditionally.
        if (annotation.hascompletion == 1 && annotation.xp > 0) {
            if (Number(annotation.earned) % 1 != 0) {
                annotation.earned = Math.round(Number(annotation.earned) * 100) / 100;
            } else {
                annotation.earned = Number(annotation.earned);
            }
            let earned = annotation.earned == annotation.xp ? annotation.xp : annotation.earned + '/' + annotation.xp;
            completionbutton += `<span class="badge ${annotation.completed ? 'alert-success' : 'iv-badge-secondary'} iv-mr-2">
        ${annotation.completed ? earned : Number(annotation.xp)} XP</span>`;
        }
        // Display the completion button conditionally.

        completionbutton += await Templates.render('mod_flexbook/canvas/completionbutton', {
            id: annotation.id,
            manual: annotation.completiontracking == 'manual',
            iscompleted: annotation.completed,
            isPlayerMode: !self.isEditMode() && !self.isPreviewMode(),
            refreshonly: (annotation.hascompletion != 1) || self.isEditMode(),
            iseditor: state.config.iseditor,
            editurl: M.cfg.wwwroot + '/mod/flexbook/interactions.php?id=' + this.cm + '&aid=' + annotation.id
        });

        // Append refresh button after the completion button.
        if (self.isPreviewMode()) {
            completionbutton = ``;
        }

        const settings = safeParse(annotation.advanced, {});
        const isPlayerMode = !self.isEditMode() && !self.isPreviewMode();
        const chrome = await self.buildHeaderChrome(annotation, isPlayerMode);

        let prop = safeParse(annotation.prop, {});
        let logourl = null;
        if ($('body').hasClass('kidtheme') && prop.component) {
            logourl = M.util.image_url('cicon', prop.component);
        }

        let messageTitle = await Templates.render('mod_flexbook/canvas/messagetitle', {
            icon: prop.icon || 'bi bi-info-circle',
            logourl: logourl,
            title: annotation.formattedtitle || '',
            completionbutton: completionbutton,
            id: annotation.id,
            headeractions: chrome.headeractions,
            instructionstoggle: chrome.instructionstoggle,
            showinstructions: chrome.showinstructions,
            bottomheader: settings.bottomheader == 1,
            darkmode: state.config.darkmode
        });

        const $message = await self.handleInlineDisplay(annotation, messageTitle, $annotationcontent);

        await self.applyContent(annotation, $message);

        // Set focus on the #message element
        $message[0].focus();

        if (annotation.hascompletion == 1 && annotation.completiontracking == 'manual') {
            this.enableManualCompletion(annotation);
        }

        if (annotation.completed) {
            return;
        }

        if ((annotation.completiontracking == 'view' || annotation.completiontracking == 'manual')
            && annotation.requiremintime > 0) {
            let todo = await getString("spendatleast", "mod_interactivevideo", annotation.requiremintime);
            const bs = self.isBS5 ? '-bs' : '';
            const safeTodo = todo.replace(/"/g, '&quot;');
            const infoIcon = `<i class="bi bi-info-circle-fill iv-mr-2 info"
                data${bs}-toggle="tooltip"
                data${bs}-html="true"
                data${bs}-placement="auto"
                data${bs}-container="#message"
                title="${safeTodo}"></i>`;


            if (state.isMascotActive && state.say) {
                state.say(todo, 0);
                state.animate('jump');
            } else {
                let $completiontoggle = $message.find('#completiontoggle');
                $message.find('#title .info').remove();
                $completiontoggle.before(infoIcon);
                // Show and hide tooltip
                const $tooltip = $message.find('#title .info');
                $tooltip.tooltip('dispose');
                setTimeout(() => {
                    $tooltip.tooltip({
                        container: $message,
                        html: true,
                        trigger: 'hover',
                        placement: 'auto'
                    });
                    $tooltip.tooltip('show');
                    setTimeout(() => $tooltip.tooltip('hide'), 2000);
                }, 2000);
            }
        }
    }

    // eslint-disable-next-line no-unused-vars
    async islocked(annotation, annotations) {
        if (state.config.iseditor) {
            return false;
        }
        return false;
    }

    async handleInlineDisplay(annotation, messageTitle = '', $annotationcontent) {
        const advanced = safeParse(annotation.advanced, {});
        let hideheader = !isReportPage() && advanced.hideheader == 1;
        const isEmbed = state.config?.isEmbedMode === true;
        const modalClass = isEmbed ? '' : ' modal';
        const showClass = isEmbed ? ' show active' : '';
        const headerHidden = hideheader || (isEmbed && messageTitle === '');
        return new Promise((resolve) => {
            $annotationcontent.append(`<div id="message" style="z-index:105;top:0;" data-placement="inline"
         data-id="${annotation.id}" class="${annotation.type}${modalClass}` +
         `${headerHidden ? ' header-hidden' : ''}${showClass}" tabindex="0">
         ${messageTitle !== '' ?
            `<div id="title" class="modal-header iv-rounded-0 ${hideheader ? "hide-header" : "shadow-sm"} ` +
            `${state.config.darkmode ? 'btn-dark' : ''} ` +
            `${advanced.bottomheader == 1 ? "bottom-header" : ""}">
         ${messageTitle}</div>` : ''}
         <div class="modal-body" id="content"></div></div>`);
            const $message = $(`#message[data-id='${annotation.id}']`);
            if (isEmbed) {
                resolve($message);
                return;
            }
            $message.fadeIn(300, function() {
                resolve($(this));
            });
        });
    }

    async render(annotation, format = 'html') {
        const annotationArgs = {
            ...annotation,
            contextid: annotation.contextid || M.cfg.contextid
        };

        // Sanitize annotationArgs to remove any undefined values.
        // Undefined values cause Moodle's Fragment web service to fail with "Missing required key: value".
        Object.keys(annotationArgs).forEach(key => {
            if (annotationArgs[key] === undefined) {
                delete annotationArgs[key];
            }
        });

        let fragment;
        try {
            fragment = await Fragment.loadFragment('mod_flexbook', 'getcontent', annotation.contextid || M.cfg.contextid,
                annotationArgs);
        } catch (error) {
            throw new Error(JSON.stringify(error));
        }
        if (format === 'html') {
            return fragment;
        } else {
            return safeParse(fragment, {});
        }
    }

    /**
     * Format text content using Moodle filters and pluginfile URL rewriting.
     * @param {string} text The text to format.
     * @param {number|null} contextid The context id.
     * @param {number} format The text format (0 = FORMAT_MOODLE, 1 = FORMAT_HTML).
     * @param {number} itemid The item id for pluginfile URLs.
     * @returns {Promise<string>}
     */
    async formatContent(text, contextid = null, format = 1, itemid = 0) {
        return formatFlexbookContent(text, contextid, format, itemid);
    }

    /**
     * Applies content to the specified annotation element.
     *
     * This function renders the content for the given annotation, updates the
     * corresponding message element in the DOM, and performs post-render actions.
     * If the annotation is marked as completed, it exits early. If the annotation
     * requires completion tracking and the tracking type is 'view', it toggles the
     * completion status automatically.
     *
     * @param {Object} annotation - The annotation object containing content and metadata.
     * @param {Object} $message - The message element in the DOM.
     * @returns {Promise<void>} A promise that resolves when the content is applied.
     */
    async applyContent(annotation, $message = null) {
        const self = this;
        // We don't need to run the render method every time the content is applied. We can cache the content.
        if (!self.cache[annotation.id] || self.isEditMode()) {
            self.cache[annotation.id] = await self.render(annotation);
        }
        const data = self.cache[annotation.id];
        if ($message) {
            const $body = $message.find('.modal-body');
            $body.html(data);
            $body.attr('id', 'content');
            await self.postContentRender(annotation, $message);
        }
        if (annotation.completed || self.isEditMode() || self.isPreviewMode() || self.isEmbedMode()) {
            return;
        }
        this.completiononview(annotation);
    }

    /**
     * Method to handle automatic completion on view with required minimum time
     * @param {Object} annotation The annotation object
     * @returns {void}
     */
    async completiononview(annotation) {
        let self = this;
        if (annotation.hascompletion != 1 || annotation.completiontracking !== 'view') {
            return;
        }

        const requiredMs = annotation.requiremintime * 60 * 1000;

        const getTimespent = async() => state.getTimespent ? await state.getTimespent(annotation.id) : 0;

        // Check immediately in case the user already accumulated enough time.
        if (await getTimespent() >= requiredMs) {
            self.toggleCompletion(annotation.id, 'mark-done', 'automatic');
            return;
        }

        // Poll every 10 s, reading directly from state.interactionData.
        const runInterval = setInterval(async() => {
            const windowAnno = state.annotations.find(x => x.id == annotation.id);
            if (!windowAnno || windowAnno.completed) {
                clearInterval(runInterval);
                return;
            }
            if (await getTimespent() >= requiredMs) {
                clearInterval(runInterval);
                self.toggleCompletion(annotation.id, 'mark-done', 'automatic');
            }
        }, 1000 * 10);

        // Stop polling if the user navigates away from this interaction.
        $(document).on('interactionclose interactionrefresh', function(e) {
            if (e.detail && e.detail.annotation && e.detail.annotation.id == annotation.id) {
                clearInterval(runInterval);
            }
        });
    }

    /**
     * Callback to excute after item is successfully marked complete or incomplete.
     * @param {Array} annotations Updated annotations
     * @param {Object} thisItem The current annotation
     * @param {string} action The action performed (e.g. mark-done, mark-undone)
     * @param {string} type The type of completion (e.g. manual, automatic)
     */
    // eslint-disable-next-line complexity
    async completionCallback(annotations, thisItem, action, type) {
        const $message = $(`#message[data-id='${thisItem.id}']`);
        const $toggleButton = $message.find(`#completiontoggle`);
        if (type == 'manual') {
            $toggleButton.prop('disabled', false);
            $toggleButton.find(`i`)
                .removeClass('fa-spin bi-arrow-repeat')
                .addClass(action == 'mark-done' ? 'bi-check2' : 'bi-circle');
            $toggleButton.find(`span`).show();
        } else if (type == 'automatic') {
            $toggleButton.find(`i`).removeClass('bi-check2 bi-circle')
                .addClass(action == 'mark-done' ? 'bi-check2' : 'bi-circle');
        }

        let earned = Number(thisItem.earned);
        // Rounded to 2 decimal places if earned is not an integer.
        if (earned % 1 != 0) {
            earned = Math.round(earned * 100) / 100;
        }

        const $badge = $message.find(`#title .badge`);
        const $delete = $message.find(`[data-action="delete-completion"]`);
        if (action == 'mark-done') {
            $toggleButton
                .removeClass('btn-secondary mark-done')
                .addClass('btn-success mark-undone');
            // Play a popup sound.
            state.audio?.point.play();
            $badge.removeClass('iv-badge-secondary').addClass('alert-success');
            if (thisItem.xp > 0) {
                $badge.text(thisItem.earned == thisItem.xp ?
                    thisItem.xp + ' XP' : `${earned}/${thisItem.xp} XP`);
            } else {
                $badge.hide();
            }
            let settings = safeParse(thisItem.advanced, {});

            if ((this.options.isCompleted && settings.deleteaftercomplete == 1)
                || (!this.options.isCompleted && settings.deletebeforecomplete == 1)) {
                $delete.removeClass('d-none');
            } else {
                $delete.addClass('d-none');
            }
        } else if (action == 'mark-undone') {
            $toggleButton
                .removeClass('btn-success mark-undone').addClass('btn-secondary mark-done');
            // Play a popup sound.
            state.audio?.pop.play();
            $badge.removeClass('alert-success').addClass('iv-badge-secondary');
            $delete.addClass('d-none');
        }

        // Update the completion button.
        $toggleButton.find(`span`).text('');
        if (thisItem.earned > 0) {
            if (action == 'mark-undone') {
                this.addNotification(await getString('xplost', 'mod_interactivevideo', earned), 'info', '☹️');
            } else if (action == 'mark-done') {
                this.addNotification(await getString('xpearned', 'mod_interactivevideo', earned), 'success', '⭐');
            }
        }

        if (type == 'manual') {
            let string = action == 'mark-done'
                ? await getString('completionmarkincomplete', 'mod_interactivevideo')
                : await getString('completionmarkcomplete', 'mod_interactivevideo');
            $toggleButton.find(`span`).text(string);
        } else if (type == 'automatic') {
            let string = action == 'mark-done'
                ? await getString('completioncompleted', 'mod_interactivevideo')
                : await getString('completionincomplete', 'mod_interactivevideo');
            $toggleButton.find(`span`).text(string);
        }
        return 'done';
    }

    /**
     * Toggle completion of an item
     * @param {number} id The annotation id
     * @param {string} action The action to perform (mark-done, mark-undone)
     * @param {string} type The type of completion (manual, automatic)
     * @param {{}} [details={}] Completion details
     * @param {boolean} [callback=true] Whether to trigger the completion callback
     * @returns {Promise<string>}
     */
    // eslint-disable-next-line complexity
    async toggleCompletion(id, action, type = 'manual', details = {}, callback = true) {
        // Skip if the page is the interactions page or in preview-mode.
        if (this.isEditMode()) {
            return Promise.resolve(); // Return a resolved promise for consistency
        }
        if (this.isEmbedMode()) {
            return Promise.resolve();
        }
        if (this.isPreviewMode()) {
            this.addNotification(await getString('completionnotrecordedinpreviewmode', 'mod_interactivevideo'));
            return Promise.resolve(); // Return a resolved promise for consistency
        }
        // Gradable items (hascompletion)
        const gradableitems = this.annotations.filter(x => x.hascompletion == '1');
        const totalXp = gradableitems.map(({xp}) => Number(xp)).reduce((a, b) => a + b, 0);
        let completedItems = gradableitems.filter(({completed}) => completed);
        let earnedXp = completedItems.map(({earned}) => Number(earned)).reduce((a, b) => a + b, 0);

        completedItems = completedItems.map(({id}) => id);
        let thisItem = gradableitems.find(({id: itemId}) => itemId == id);
        let completionDetails = {
            id,
        };
        if (action == 'mark-done') {
            const completeTime = new Date();
            completionDetails.hasDetails = details.details ? true : false;
            if (details.hasDetails) {
                completionDetails.hasDetails = true;
            }
            completionDetails.xp = (details.xp !== undefined && details.xp !== null) ? details.xp : thisItem.xp;
            completionDetails.percent = (details.percent !== undefined && details.percent !== null) ? details.percent : 1;
            // eslint-disable-next-line no-nested-ternary
            completionDetails.duration = (details.duration !== undefined && details.duration !== null)
                ? details.duration
                : (state.getTimespent ? await state.getTimespent(id) : 0);
            completionDetails.timecompleted = (details.timecompleted !== undefined && details.timecompleted !== null)
                ? details.timecompleted : completeTime.getTime();
            const completiontime = completeTime.toLocaleString();
            let duration = await this.formatTime(completionDetails.duration / 1000);
            completionDetails.reportView = details.reportView ||
                `##${completiontime}|${duration}|${Number(completionDetails.xp)}`; // ## indicates new format.
        }
        if (action == 'mark-done') {
            completedItems.push(id.toString());
            if (thisItem.earned > 0) { // In case of resubmission.
                // Remove the earned XP from the total XP.
                earnedXp -= Number(thisItem.earned);
            }
            earnedXp += Number(completionDetails.xp);
        } else if (action == 'mark-undone') {
            completedItems = completedItems.filter(itemId => itemId != id);
            earnedXp -= Number(thisItem.earned);
        }

        // Make sure the completed items are unique.
        completedItems = [...new Set(completedItems)];

        let completed;
        if (Number(this.completionpercentage) > 0) { // Completion percentage is set.
            completed = (completedItems.length / gradableitems.length) * 100 >= Number(this.completionpercentage) ? 1 : 0;
        } else {
            completed = gradableitems.length == completedItems.length ? 1 : 0;
        }
        let g = parseFloat((earnedXp / totalXp) * this.grademax).toFixed(2);
        if (isNaN(g) || !g || g < 0) {
            g = 0;
        }
        const progressArgs = {
            contextid: M.cfg.contextid,
            id: this.flexbook,
            markdone: action == 'mark-done',
            uid: this.userid,
            percentage: (completedItems.length / gradableitems.length) * 100,
            g,
            gradeiteminstance: this.gradeiteminstance,
            c: completed,
            xp: earnedXp,
            completeditems: JSON.stringify(completedItems),
            completiondetails: JSON.stringify(completionDetails),
            details: JSON.stringify(details.details || {}),
            annotationtype: this.prop.name,
            cmid: this.cm,
            completionid: this.completionid,
            updatestate: this.completionpercentage > 0 || Object.keys(this.extracompletion).length != 0 ? 1 : 0,
            courseid: this.course,
        };

        const saveProgress = await Ajax.call([{
            methodname: 'mod_flexbook_save_progress',
            args: progressArgs,
        }])[0];

        this.annotations = this.annotations.map(x => {
            if (x.id == id) {
                x.completed = action == 'mark-done';
                x.earned = completionDetails.xp || 0;
            }
            return x;
        });
        // Dispatch an event to update the UI.
        dispatchEvent('requireuiupdate', {
            annotations: this.annotations,
        });
        thisItem.earned = completionDetails.xp || 0;
        if (callback == true) {
            this.completionCallback(this.annotations, thisItem, action, type);
        }
        let completion = saveProgress.overallcomplete;
        this.options.isCompleted = completion && completion > 0;

        dispatchEvent('completionupdated', {
            annotations: this.annotations,
            completionpercentage: (completedItems.length / gradableitems.length) * 100,
            grade: parseFloat((earnedXp / totalXp) * this.grademax).toFixed(2),
            completed,
            xp: earnedXp,
            completeditems: completedItems,
            target: thisItem,
            action,
            type,
            response: saveProgress,
        });

        return saveProgress.overallcomplete;

    }

    /**
     * Enable manual completion of item
     * @param {Object} annotation The annotation object
     * @returns {void}
     */
    enableManualCompletion(annotation) {
        let self = this;
        const $message = $(`#message[data-id='${annotation.id}']`);
        $message.off('click', 'button#completiontoggle').on('click', 'button#completiontoggle', async function(e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            // Implement required min minutes.
            if ($(this).hasClass('mark-done') && annotation.requiremintime > 0) {
                // Use state.getTimespent() to include any live unflused elapsed time.
                const timespentMs = state.getTimespent ? await state.getTimespent(annotation.id) : 0;
                const duration = timespentMs / 1000 / 60; // Convert ms â†’ minutes.
                if (duration < annotation.requiremintime) {
                    self.addNotification(
                        await getString('youmustspendatleastminutesbeforemarkingcomplete', 'mod_interactivevideo',
                            {
                                timerequire: annotation.requiremintime,
                                timespent: duration.toFixed(2)
                            }), 'danger', '⏲️');
                    return;
                }
            }
            $(this).attr('disabled', true);
            $(this).find('i').removeClass('bi-check2 bi-circle').addClass('fa-spin bi-arrow-repeat');
            $(this).find('span').hide();
            // Get the completed items
            const annoid = $(this).data('id');
            self.toggleCompletion(annoid, $(this).hasClass('mark-done') ? 'mark-done' : 'mark-undone', 'manual');
        });
    }

    /**
     * Called when the edit form is loaded.
     * @param {Object} form The form
     * @return {jQuery} The modal body element
     */
    onEditFormLoaded(form) {
        return form.modal.modal.find('.modal-body');
    }

    /**
     * Called after the annotation is edited/added/quick edited (after everything is rendered).
     * @param {Object} annotation The annotation object
     * @return {void}
     */
    postEditCallback(annotation) {
        return this.previewInteraction(annotation);
    }

    /**
     * Check if the page is in edit mode
     * @returns {boolean}
     */
    isEditMode() {
        return this.options.isEditMode;
    }

    /**
     * Check if the page is in preview mode
     * @returns {boolean}
     */
    isPreviewMode() {
        return this.options.isPreviewMode;
    }

    /**
     * Check if the page is in standalone embed mode.
     * @returns {boolean}
     */
    isEmbedMode() {
        return this.options.isEmbedMode;
    }

    /**
     * Check if the annotation is clickable from video navigation
     * @param {Object} annotation
     * @returns boolean
     */
    isClickable(annotation) {
        if (this.isEditMode() || state.config.iseditor) {
            return true;
        }
        const advanced = safeParse(annotation.advanced, {});
        return (advanced.clickablebeforecompleted == "1" && !annotation.completed)
            || (advanced.clickableaftercompleted == "1" && annotation.completed);
    }

    /**
     * Visibility on the video navigation
     * @param {Object} annotation
     * @returns boolean
     */
    isVisible(annotation) {
        if (this.isEditMode() || state.config.iseditor) {
            return true;
        }
        const advanced = safeParse(annotation.advanced, {});
        return (advanced.visiblebeforecompleted == "1" && !annotation.completed)
            || (advanced.visibleaftercompleted == "1" && annotation.completed);
    }

    /**
     * Renders an annotation item for the chapter/sidebar list.
     * @param {Object} annotation - The annotation object to render.
     * @returns {string} The HTML string for the chapter item.
     */
    renderChapterItem(annotation) {
        let classes = annotation.type + ' annotation ';
        if (annotation.completed) {
            classes += ' completed ';
        }
        if (!this.isClickable(annotation)) {
            classes += ' no-pointer-events ';
        }
        if (annotation.hascompletion == 0) {
            classes += ' no-completion ';
        }
        if (annotation.locked) {
            classes += ' lock ';
        }
        if (!this.isVisible(annotation)) {
            classes += ' d-none ';
        }
        let logourl = null;
        let prop = safeParse(annotation.prop, {});
        if ($('body').hasClass('kidtheme') && prop.component) {
            logourl = M.util.image_url('cicon', prop.component);
        }

        let iconHtml = `<i class="fs-unset ${annotation.locked ? 'fa fa-lock' : (prop.icon || this.prop.icon)} iv-mr-2"></i>`;
        if (logourl && !annotation.locked) {
            iconHtml = `<img src="${logourl}" class="iv-mr-2" height="24" loading="lazy" ` +
                       `onerror="this.remove(); this.nextElementSibling.classList.remove('d-none');">` +
                       `<i class="fs-unset ${prop.icon || this.prop.icon} iv-mr-2 d-none"></i>`;
        }

        const xpHtml = annotation.xp > 0
            ? `<span class="text-nowrap xp-pill">
                     ${annotation.xp}<i class="bi bi-star iv-ml-1 fs-unset"></i></span>`
            : '';
        let html = `<li class="anno d-flex align-items-center justify-content-between small
                     p-2 ${annotation.completed ? "completed" : ""} ${classes}" data-id="${annotation.id}">
                     <span class="text-nowrap">
                     <i class="fs-unset bi ${annotation.completed ? "bi-check-circle-fill text-success" : 'bi-circle'}
                      iv-mr-2 ${annotation.hascompletion == 0 ? "invisible" : ""}"></i>
                     ${iconHtml}
                     </span>
                     <span class="flex-grow-1 text-truncate">${annotation.formattedtitle}</span>
                     ${annotation.hascompletion == 0 ? '' : xpHtml}</li>`;
        return html;
    }

    renderReportView(annotation, details, data) {
        let res = `<span class="completion-detail ${details.hasDetails ? 'cursor-pointer' : ''}"` +
            ` data-id="${data.itemid}" data-userid="${data.row.id}" data-type="${data.ctype}">`;
        if (!details.reportView.startsWith('##')) {
            res += `${details.reportView}</span>`;
        } else {
            let rdata = details.reportView.split('|');
            rdata[0] = rdata[0].replace('##', '');
            const bsAffix = (getMoodleVersion() > 405 || $('body').hasClass('bs-5')) ? '-bs' : '';
            res += `<span class="cursor-pointer" data${bsAffix}-toggle="tooltip" data${bsAffix}-html="true"
                 data${bsAffix}-title='<span class="d-flex flex-column align-items-start">` +
                `<span><i class="bi bi-calendar iv-mr-2"></i>${rdata[0]?.trim()}</span>` +
                `<span><i class="bi bi-stopwatch iv-mr-2"></i>${rdata[1]?.trim()}</span></span>'>
                 <i class="fa fa-check text-success"></i><br><span>${rdata[2]?.trim()}</span></span></span>`;
        }
        if (data.access.canedit == 1) {
            res += `<i class="bi bi-trash3 fs-unset text-danger cursor-pointer position-absolute delete-cell" `
                + `title="${M.util.get_string('delete', 'mod_interactivevideo')}"></i>`;
        }
        return res;
    }

    /**
     * Data to show when the report viewer clicks on the completion checkmark
     * @param {Object} annotation the current annotation
     * @param {Number} userid the user id
     * @returns {Promise}
     */
    getCompletionData(annotation, userid) {
        return Promise.resolve({
            annotation: annotation,
            userid: userid
        });
    }

    /**
     * View when the report viewer clicks on the title of the interaction item on the report page
     * @param {Object} annotation the annotation
     * @param {Array} tabledatajson the table data json
     * @param {Object} DataTable the data table
     * @param {jQuery} root the root element
     * @returns {void}
     */
    async displayReportView(annotation, tabledatajson, DataTable, root) {
        this.isflexbook = true;
        const data = await this.render(annotation, 'html');
        let $message = root.find(`#message[data-id='${annotation.id}']`);
        $message.find(`.modal-body`).html(data);
        $message.find(`.modal-body`).attr('id', 'content');
        this.postContentRender(annotation, $message);

        return data;
    }

    /**
     * Get the log data for multiple users from annotation_log table
     * @param {Object} annotation the annotation
     * @param {Array} userids array of user ids
     * @returns {Promise}
     */
    async getLogs(annotation, userids) {
        let self = this;
        userids = userids.join(',');
        const logs = await Ajax.call([{
            methodname: 'mod_flexbook_get_logs',
            args: {
                contextid: M.cfg.contextid,
                userids: userids,
                annotationid: annotation.id,
                type: self.prop.name,
                cmid: self.cm,
            }
        }])[0];
        if (logs.status == 'success') {
            return JSON.parse(logs.data);
        } else {
            return [];
        }
    }

    /**
     * Save log data for a specific user
     * @param {Object} annotation the annotation
     * @param {Object} data the log data
     * @param {Number} userid the user id
     * @param {Number} replaceexisting replace existing log flag
     * @returns {Promise}
     */
    async saveLog(annotation, data, userid, replaceexisting = 1) {
        const log = await Ajax.call([{
            methodname: 'mod_flexbook_save_log',
            args: {
                contextid: M.cfg.contextid,
                annotationid: annotation.id,
                data: JSON.stringify(buildSaveLogPayload(data, this.completionid)),
                userid: userid,
                replaceexisting: replaceexisting,
                cmid: this.cm,
            }
        }])[0];
        return log;
    }

    /**
     * Set draggable
     * @param {string} elem The element to make draggable
     */
    setModalDraggable(elem) {
        $(elem).draggable({handle: ".modal-header"});
    }

    /**
     * Delete progress for a specific annotation
     * @param {Object} annotation the annotation
     * @returns {Promise}
     */
    async deleteProgress(annotation) {
        const self = this;
        const $message = $('#message[data-id=' + annotation.id + ']');
        $message.find('[data-action="refresh"]').find('i').addClass('fa-spin');

        try {
            if (!self.isEditMode() && !self.isPreviewMode()) {
                await self.toggleCompletion(annotation.id, 'mark-undone', 'automatic', {}, false);
            }

            await Ajax.call([{
                methodname: 'mod_flexbook_delete_own_completion_data',
                args: {
                    contextid: M.cfg.contextid,
                    id: self.completionid,
                    itemid: annotation.id,
                    userid: self.userid,
                }
            }])[0];

            delete self.cache[annotation.id];
            dispatchEvent('fb:refresh_interaction', {id: annotation.id});
            self.addNotification(await getString('progressdeleted', 'mod_flexbook'), 'success', '🗑️');
        } catch (error) {
            window.console.error(error);
        } finally {
            $message.find('[data-action="refresh"]').find('i').removeClass('fa-spin');
        }
    }
}
