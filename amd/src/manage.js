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
 * Manage page interactions for Flexbook (course defaults and settings tabs).
 *
 * @module     mod_flexbook/manage
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import $ from 'jquery';
import Ajax from 'core/ajax';
import DynamicForm from 'core_form/dynamicform';
import {add as addToast} from 'core/toast';
import Notification from 'core/notification';
import {get_string as getString} from 'core/str';

export default {
    /**
     * Wire up the course defaults settings form (appearance, behavior, completion).
     *
     * @param {number} courseid The course ID.
     * @param {number} coursecontextid The course context ID.
     */
    settings: async function(courseid, coursecontextid) {
        const selector = document.querySelector('#region-main-box #settings');
        if (!selector) {
            return;
        }
        const settingform = new DynamicForm(selector, 'mod_flexbook\\form\\settings_form');
        settingform.addEventListener(settingform.events.FORM_SUBMITTED, async(e) => {
            e.preventDefault();
            addToast(await getString('settingssaved', 'mod_interactivevideo'), {type: 'success'});
        });
        settingform.addEventListener(settingform.events.CANCEL_BUTTON_PRESSED, async(e) => {
            e.preventDefault();
            settingform.load({
                courseid: courseid,
                contextid: coursecontextid,
                action: 'reset',
            });
            addToast(await getString('formvaluesarereset', 'mod_interactivevideo'), {type: 'info'});
        });
    },
    /**
     * Wire up the interaction defaults tab: delete saved defaults per content type.
     *
     * @param {number} courseid The course ID.
     * @param {number} coursecontextid The course context ID.
     */
    defaults: function(courseid, coursecontextid) {
        $(document).off('click', '[data-action="delete-default"]')
            .on('click', '[data-action="delete-default"]', async function(e) {
                e.preventDefault();
                const row = $(this).closest('tr');
                const type = $(this).data('type');
                const title = row.find('td').first().text().trim();
                try {
                    await Notification.saveCancelPromise(
                        getString('delete', 'core'),
                        getString('confirmdeletedefault', 'mod_flexbook', title),
                        getString('delete', 'core')
                    );
                } catch (cancelled) {
                    return;
                }
                try {
                    await Ajax.call([{
                        methodname: 'mod_flexbook_delete_default',
                        args: {
                            contextid: coursecontextid,
                            courseid: courseid,
                            type: type,
                        }
                    }])[0];
                    row.remove();
                    addToast(await getString('defaultdeleted', 'mod_flexbook'), {type: 'success'});
                    if ($('#defaults table tbody tr').length === 0) {
                        window.location.reload();
                    }
                } catch (error) {
                    addToast(await getString('anerroroccured', 'mod_flexbook'), {type: 'danger'});
                }
            });
    },
};
