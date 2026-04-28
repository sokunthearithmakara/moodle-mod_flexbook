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
import {safeParse, getMoodleVersion} from '../utils';

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
     * Dispatch an event
     * @param {string} name The event name
     * @param {Object} detail The event detail
     * @returns {void}
     */
    dispatchEvent(name, detail) {
        dispatchEvent(name, detail);
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
            listItem.find('.btn.xp span').text(item.xp);
            listItem.attr('data-xp', item.xp);
        } else {
            listItem.find('.btn.xp').remove();
        }

        listItem.find('.type-icon i').addClass(this.prop.icon);
        listItem.find('.type-icon').attr('title', this.prop.title);

        listItem.find('[data-field]').attr('data-id', item.id);
        listItem.find('[data-field="xp"]').val(item.xp);
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

    async renderMessageTitle(annotation) {
        let props = safeParse(annotation.prop, {});
        let $title = await Templates.render('mod_flexbook/messagetitle', {
            id: annotation.id,
            title: annotation.formattedtitle,
            icon: props.icon || 'bi bi-info-circle',
        });
        return $title;
    }

    animateModal(root) {
        setTimeout(() => {
            root.addClass('jelly-anim');
            setTimeout(() => {
                root.removeClass('jelly-anim');
            }, 500);
        }, 10);
    }

    async createModal(annotation) {
        const self = this;
        annotation = this.annotations.find(x => x.id == annotation.id);

        let ModalFactory;
        if (getMoodleVersion() < 403) {
            ModalFactory = await import('core/modal_factory');
        } else {
            ModalFactory = await import('core/modal');
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
                'data-id': annotation.id,
                'data-placement': 'popup',
                'id': 'message'
            })
            .addClass('active ' + annotation.type);
            modal.show();
            root.on(ModalEvents.hidden, () => {
                modal.destroy();
            });

            // Enable draggable.
            this.setModalDraggable('#annotation-modal .modal-dialog');

            root.find('#message').on('click', '#close-' + annotation.id, function() {
                root.attr('data-region', 'modal-container');
                root.fadeOut(300, function() {
                    modal.hide();
                });
            });

            root.off(ModalEvents.hidden).on(ModalEvents.hidden, function() {
                $('#annotation-modal').remove();
                modal.destroy();
            });

            root.on(ModalEvents.outsideClick, function(e) {
                e.preventDefault();
                self.animateModal(root);
            });

            root.on(ModalEvents.shown, async() => {
                self.animateModal(root);
                root.find('.modal-header').attr('id', 'title')
                    .html(await this.renderMessageTitle(annotation));
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

    async postContentRender() {
        // Do nothing.
        return;
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
            isPlayerMode: true,
            refreshonly: annotation.hascompletion != 1
        });

        // Append refresh button after the completion button.
        if (self.isPreviewMode()) {
            completionbutton = ``;
        }

        // Message title.
        let showdelete = false;
        let settings = safeParse(annotation.advanced, {});
        if (settings.deletebeforecomplete == 1 || settings.deleteaftercomplete == 1) {
            showdelete = true;
        }

        if (annotation.hascompletion == 0 || annotation.completiontracking == 'manual' || annotation.completiontracking == 'none') {
            showdelete = false;
        }

        let prop = safeParse(annotation.prop, {});
        annotation.activitycomplete = this.options.isCompleted ? 1 : 0;
        let logourl = null;
        if ($('body').hasClass('kidtheme') && prop.component) {
            logourl = M.util.image_url('monologo', prop.component);
        }

        let messageTitle = await Templates.render('mod_flexbook/canvas/messagetitle', {
            icon: prop.icon || 'bi bi-info-circle',
            logourl: logourl,
            title: annotation.formattedtitle || '',
            completionbutton: completionbutton,
            id: annotation.id,
            showdelete,
            candelete: annotation.completed == true && ((annotation.activitycomplete == 1 && settings.deleteaftercomplete == 1) ||
                (annotation.activitycomplete == 0 && settings.deletebeforecomplete == 1)),
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
            const infoIcon = `<i class="bi bi-info-circle-fill iv-mr-2 info" title="${todo}"></i>`;


            if (state.isMascotActive && state.say) {
                state.say(todo, 0);
                state.animate('jump');
            } else {
                let $completiontoggle = $message.find('#completiontoggle');
                $message.find('#title .info').remove();
                $completiontoggle.before(infoIcon);
                // Show and hide tooltip
                const $tooltip = $(`#message[data-id='${annotation.id}'] #title .info`);
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
        let hideheader = false;
        if (advanced.hideheader == 1) {
            hideheader = true;
        }
        return new Promise((resolve) => {
            $annotationcontent.append(`<div id="message" style="z-index:105;top:0;" data-placement="inline"
         data-id="${annotation.id}" class="${annotation.type} modal" tabindex="0">
         ${messageTitle !== '' ?
            `<div id="title" class="modal-header iv-rounded-0 ${hideheader == 1 ? "hide-header" : "shadow-sm"}">
         ${messageTitle}</div>` : ''}
         <div class="modal-body" id="content"></div></div>`);
            $(`#message[data-id='${annotation.id}']`).fadeIn(300, function() {
                resolve($(this));
            });
        });
    }

    async render(annotation, format = 'html') {
        const annotationArgs = {
            ...annotation,
            contextid: annotation.contextid
        };
        let fragment;
        try {
            fragment = await Fragment.loadFragment('mod_flexbook', 'getcontent', annotation.contextid, annotationArgs);
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
        if (annotation.completed || self.isEditMode()) {
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
        const $delete = $message.find(`#delete-completiondata`);
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
                this.addNotification(await getString('xplost', 'mod_interactivevideo', earned), 'info', '⭐');
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
        const saveProgress = await Ajax.call([{
            methodname: 'mod_flexbook_save_progress',
            args: {
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
            }
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
                const duration = timespentMs / 1000 / 60; // Convert ms → minutes.
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

    async renderNavItem(annotations, annotation, $annotationbar) {
        let self = this;
        let locked = false;
        if (await this.islocked(annotation, annotations) == true) {
            locked = true;
        }
        annotation.locked = locked;
        let classes = annotation.type + ' annotation ';
        if (!annotation.show) {
            classes += ' d-none ';
        }
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
        let title = annotation.formattedtitle;
        title = title.replace(/'/g, '&apos;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/&/g, '&amp;');
        let logourl = null;
        if ($('body').hasClass('kidtheme') && this.prop.component) {
            logourl = M.util.image_url('monologo', this.prop.component);
        }

        let iconHtml = `<i class="${annotation.locked ? 'bi bi-lock' : this.prop.icon} iv-mr-2"></i>`;
        if (logourl && !annotation.locked) {
            iconHtml = `<img src="${logourl}" class="iv-mr-2" height="24" loading="lazy" ` +
                       `onerror="this.remove(); this.nextElementSibling.classList.remove('d-none');">` +
                       `<i class="${this.prop.icon} iv-mr-2 d-none"></i>`;
        }

        const $item = $(`<span class="annotation-item ${classes}" data-id="${annotation.id}" tabindex="0"></span>`);
        const bs = self.isBS5 ? '-bs' : '';
        $item.attr(`data${bs}-toggle`, 'tooltip');
        $item.attr(`data${bs}-container`, '#wrapper');
        $item.attr(`data${bs}-trigger`, 'hover');
        $item.attr(`data${bs}-placement`, 'top');
        $item.attr(`data${bs}-html`, 'true');
        $item.attr('title', `<div class="d-flex align-items-center">${iconHtml}<span>${title}</span></div>`);

        $annotationbar.append($item);
        return locked;
    }

    /**
     * Check if the page is in preview mode
     * @returns {boolean}
     */
    isPreviewMode() {
        return this.options.isPreviewMode;
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

    renderReportView(annotation, details, data) {
        let res = `<span class="completion-detail ${details.hasDetails ? 'cursor-pointer' : ''}"` +
            ` data-id="${data.itemid}" data-userid="${data.row.id}" data-type="${data.ctype}">`;
        if (!details.reportView.startsWith('##')) {
            res += `${details.reportView}</span>`;
        } else {
            let rdata = details.reportView.split('|');
            rdata[0] = rdata[0].replace('##', '');
            let bsAffix = window.M.version > 405 ? '-bs' : '';
            res += `<span data${bsAffix}-toggle="tooltip" data${bsAffix}-html="true"
                 title='<span class="d-flex flex-column align-items-start"><span><i class="bi bi-calendar iv-mr-2"></i>
                 ${rdata[0]?.trim()}</span><span><i class="bi bi-stopwatch iv-mr-2"></i>${rdata[1]?.trim()}</span></span>'>
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
     * @returns {void}
     */
    async displayReportView(annotation) {
        const data = await this.render(annotation, 'html');
        let $message = $(`#message[data-id='${annotation.id}']`);
        $message.find(`.modal-body`).html(data);
        $message.find(`.modal-body`).attr('id', 'content');
        this.postContentRender(annotation, $message);
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
        let self = this;
        const log = await Ajax.call([{
            methodname: 'mod_flexbook_save_log',
            args: {
                contextid: M.cfg.contextid,
                annotationid: annotation.id,
                data: JSON.stringify({
                    'text1': data.text1 || '',
                    'text2': data.text2 || '',
                    'text3': data.text3 || '',
                    'char1': data.char1 || '',
                    'char2': data.char2 || '',
                    'char3': data.char3 || '',
                    'intg1': data.intg1 || 0,
                    'intg2': data.intg2 || 0,
                    'intg3': data.intg3 || 0,
                    'flt1': data.flt1 || 0,
                    'flt2': data.flt2 || 0,
                    'flt3': data.flt3 || 0,
                    'bool1': data.bool1 || 0,
                    'bool2': data.bool2 || 0,
                    'bool3': data.bool3 || 0,
                }),
                userid: userid,
                replaceexisting: replaceexisting,
                cmid: self.cm,
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
        let self = this;
        let $message = $('#message[data-id=' + annotation.id + ']');
        $message.find('#refresh').find('i').addClass('fa-spin');

        self.toggleCompletion(annotation.id, 'mark-undone', 'automatic', {}, false);

        $(document).off('completionupdated.deleteprogress');
        $(document).one('completionupdated.deleteprogress', async function() {
            try {
                await Ajax.call([{
                    methodname: 'mod_flexbook_delete_own_completion_data',
                    args: {
                        contextid: M.cfg.contextid,
                        id: self.completionid,
                        itemid: annotation.id,
                        userid: self.userid,
                    }
                }]);
                // Clear cache and trigger a full refresh via navigation.
                delete self.cache[annotation.id];
                dispatchEvent('fb:refresh_interaction', {id: annotation.id});
                self.addNotification(await getString('progressdeleted', 'mod_flexbook'), 'success', '🗑️');
            } catch (error) {
                window.console.error(error);
            } finally {
                $message.find('#refresh').find('i').removeClass('fa-spin');
            }
        });
    }
}