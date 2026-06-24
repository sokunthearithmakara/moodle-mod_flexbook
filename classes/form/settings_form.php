<?php
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

namespace mod_flexbook\form;

use core_grades\component_gradeitems;

/**
 * Course-level default settings form for Flexbook activities.
 *
 * @package    mod_flexbook
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class settings_form extends \core_form\dynamic_form {
    /**
     * Returns form context.
     *
     * @return \context
     */
    protected function get_context_for_dynamic_submission(): \context {
        $contextid = $this->optional_param('contextid', null, PARAM_INT);
        return \context::instance_by_id($contextid, MUST_EXIST);
    }

    /**
     * Checks access for dynamic submission.
     */
    protected function check_access_for_dynamic_submission(): void {
        require_capability('mod/flexbook:manage', $this->get_context_for_dynamic_submission());
    }

    /**
     * The display option keys that are persisted in the displayoptions JSON.
     *
     * @return string[]
     */
    protected function displayoption_keys(): array {
        return [
            'theme',
            'aspectratio',
            'distractionfreemode',
            'darkmode',
            'kidtheme',
            'courseindex',
            'openchapterpanel',
            'limitedwidth',
            'character',
            'showdescriptiononheader',
            'type',
            'grade',
            'gradepass',
            'gradecat',
            'completionview',
            'completionusegrade',
        ];
    }

    /**
     * Grade category field name on the activity mod_form.
     *
     * @return string
     */
    protected function get_gradecat_fieldname(): string {
        return component_gradeitems::get_field_name_for_itemnumber('mod_flexbook', 0, 'gradecat');
    }

    /**
     * Map stored grade/completion defaults onto dynamic form field names.
     *
     * @param array $values Form values.
     * @return array
     */
    protected function map_grade_completion_form_values(array $values): array {
        if (array_key_exists('gradecat', $values)) {
            $values[$this->get_gradecat_fieldname()] = $values['gradecat'];
            unset($values['gradecat']);
        }
        return $values;
    }

    /**
     * The display option keys that are stored as control groups (arrays).
     *
     * @return string[]
     */
    protected function displayoption_groups(): array {
        return [
            'beforecompletion',
            'aftercompletion',
            'beforecompletionbehavior',
            'aftercompletionbehavior',
        ];
    }

    /**
     * Sets data for dynamic submission.
     */
    public function set_data_for_dynamic_submission(): void {
        global $DB, $CFG;
        require_once($CFG->dirroot . '/mod/flexbook/lib.php');

        $courseid = $this->optional_param('courseid', null, PARAM_INT);
        $contextid = $this->optional_param('contextid', null, PARAM_INT);
        $action = $this->optional_param('action', null, PARAM_ALPHA);

        $cache = \cache::make('mod_flexbook', 'fb_settings');

        if ($action == 'reset') {
            $values = flexbook_get_site_default_form_values($courseid, $contextid);
            $this->set_data((object) $this->map_grade_completion_form_values($values));
            return;
        }

        $data = $cache->get($courseid);
        if (!$data) {
            $data = $DB->get_record('flexbook_settings', ['courseid' => $courseid]);
            if ($data) {
                $cache->set($courseid, $data);
            }
        }
        if (!$data) {
            $values = flexbook_get_site_default_form_values($courseid, $contextid);
            $this->set_data((object) $this->map_grade_completion_form_values($values));
            return;
        }

        $data->contextid = $contextid;

        // Prepare the end screen text editor.
        $draftitemid = file_get_submitted_draft_itemid('endscreentext');
        $data->endscreentext = [
            'text' => file_prepare_draft_area(
                $draftitemid,
                $contextid,
                'mod_flexbook',
                'endscreentext',
                0,
                ['subdirs' => 0],
                $data->endscreentext
            ),
            'format' => FORMAT_HTML,
            'itemid' => $draftitemid,
        ];

        $defaultvalues = (array) $data;

        // Spread the saved display options into individual form fields.
        $displayoptions = json_decode($data->displayoptions ?? '', true) ?: [];
        foreach ($this->displayoption_keys() as $key) {
            if (array_key_exists($key, $displayoptions)) {
                $defaultvalues[$key] = $displayoptions[$key];
            }
        }
        foreach ($this->displayoption_groups() as $group) {
            if (isset($displayoptions[$group]) && is_array($displayoptions[$group])) {
                $defaultvalues[$group] = $displayoptions[$group];
            }
        }

        // Reach-end completion default.
        $extendedcompletion = json_decode($data->extendedcompletion ?? '', true);
        $defaultvalues['reachend'] = !empty($extendedcompletion['reachend']) ? 1 : 0;

        $this->set_data((object) $this->map_grade_completion_form_values($defaultvalues));
    }

    /**
     * Processes the submitted form, persisting the course defaults.
     *
     * @return \stdClass
     */
    public function process_dynamic_submission() {
        global $DB, $CFG;
        require_once($CFG->dirroot . '/mod/flexbook/lib.php');

        $fromform = $this->get_data();

        $data = new \stdClass();
        $data->courseid = $fromform->courseid;
        $data->timemodified = time();
        $displayoptions = flexbook_display_options($fromform);
        $displayoptions['type'] = $fromform->type ?? '';
        $displayoptions['grade'] = $fromform->grade ?? 0;
        $displayoptions['gradepass'] = $fromform->gradepass ?? 0;
        $gradecatfieldname = $this->get_gradecat_fieldname();
        $displayoptions['gradecat'] = $fromform->{$gradecatfieldname} ?? 0;
        $displayoptions['completionview'] = $fromform->completionview ?? 0;
        $displayoptions['completionusegrade'] = $fromform->completionusegrade ?? 0;
        $data->displayoptions = json_encode($displayoptions);
        $data->displayasstartscreen = !empty($fromform->displayasstartscreen) ? 1 : 0;
        $data->completionpercentage = $fromform->completionpercentage ?? 0;

        // End screen text.
        $endscreen = $fromform->endscreentext;
        $data->endscreentext = file_save_draft_area_files(
            $endscreen['itemid'],
            $fromform->contextid,
            'mod_flexbook',
            'endscreentext',
            0,
            ['subdirs' => 0],
            $endscreen['text']
        );

        // Reach-end completion.
        $data->extendedcompletion = !empty($fromform->reachend) ? json_encode(['reachend' => 1]) : '';
        $data->completion = (
            !empty($fromform->reachend)
            || !empty($fromform->completionpercentage)
            || !empty($fromform->completionview)
            || !empty($fromform->completionusegrade)
        ) ? 1 : 0;

        $existing = $DB->get_record('flexbook_settings', ['courseid' => $data->courseid], 'id', IGNORE_MISSING);
        if ($existing) {
            $data->id = $existing->id;
            $DB->update_record('flexbook_settings', $data);
        } else {
            $data->timecreated = time();
            $data->id = $DB->insert_record('flexbook_settings', $data);
        }

        $cache = \cache::make('mod_flexbook', 'fb_settings');
        $cache->set($data->courseid, $data);

        return $data;
    }

    /**
     * Defines form elements.
     */
    public function definition() {
        global $CFG;
        require_once($CFG->dirroot . '/mod/flexbook/lib.php');
        require_once($CFG->libdir . '/gradelib.php');

        $courseid = $this->optional_param('courseid', null, PARAM_INT);
        $mform = &$this->_form;
        $attributes = $mform->getAttributes();
        $attributes['class'] = $attributes['class'] . ' container';
        $mform->setAttributes($attributes);

        $mform->addElement('hidden', 'courseid', $this->optional_param('courseid', null, PARAM_INT));
        $mform->setType('courseid', PARAM_INT);
        $mform->addElement('hidden', 'id', $this->optional_param('id', null, PARAM_INT));
        $mform->setType('id', PARAM_INT);
        $mform->addElement('hidden', 'contextid', $this->optional_param('contextid', null, PARAM_INT));
        $mform->setType('contextid', PARAM_INT);

        $mform->addElement('header', 'general', get_string('general', 'form'));

        $mform->addElement(
            'advcheckbox',
            'showdescriptiononheader',
            '',
            get_string('displaydescriptiononactivityheader', 'mod_flexbook'),
            ['group' => 1],
            [0, 1]
        );

        $mform->addElement(
            'advcheckbox',
            'displayasstartscreen',
            '',
            get_string('displayasstartscreen', 'mod_flexbook'),
            ['group' => 1],
            [0, 1]
        );

        $mform->addElement(
            'editor',
            'endscreentext',
            get_string('endscreentext', 'mod_flexbook'),
            null,
            ['maxfiles' => EDITOR_UNLIMITED_FILES, 'noclean' => true]
        );
        $mform->setType('endscreentext', PARAM_RAW);

        $typeoptions = flexbook_get_primary_content_type_options();
        if (count($typeoptions) > 1) {
            $mform->addElement('select', 'type', get_string('primarycontenttype', 'mod_flexbook'), $typeoptions);
            $mform->setType('type', PARAM_TEXT);
            $mform->setDefault('type', '');
            $mform->addHelpButton('type', 'primarycontenttype', 'mod_flexbook');
        } else {
            $mform->addElement('hidden', 'type', '');
            $mform->setType('type', PARAM_TEXT);
        }

        $mform->addElement(
            'header',
            'videodisplayoptions',
            get_string('appearanceandbehaviorsettings', 'mod_flexbook')
        );
        flexbook_appearanceandbehavior_form($mform, null);
        // Poster image is per-activity and not persisted as a course default.
        if ($mform->elementExists('posterimage')) {
            $mform->removeElement('posterimage');
        }

        $mform->addElement('header', 'completionheader', get_string('completionandgrade', 'mod_interactivevideo'));

        $mform->addElement('float', 'grade', get_string('gradenoun'), [
            'size' => 5,
            'regex' => '/^[0-9]{1,3}$/',
        ]);
        $mform->setType('grade', PARAM_INT);
        $mform->setDefault('grade', $CFG->gradepointdefault);

        $mform->addElement('float', 'gradepass', get_string('gradepass', 'grades'), [
            'size' => 5,
            'regex' => '/^[0-9]{1,3}$/',
        ]);
        $mform->setType('gradepass', PARAM_FLOAT);

        $gradecatfieldname = $this->get_gradecat_fieldname();
        $mform->addElement(
            'select',
            $gradecatfieldname,
            get_string('gradecategoryonmodform', 'grades'),
            grade_get_categories_menu($courseid)
        );

        $mform->addElement(
            'advcheckbox',
            'completionview',
            get_string('completion', 'completion'),
            get_string('completionview_desc', 'completion'),
            ['group' => 1],
            [0, 1]
        );

        $mform->addElement(
            'advcheckbox',
            'completionusegrade',
            '',
            get_string('completionusegrade', 'completion'),
            ['group' => 1],
            [0, 1]
        );

        $mform->addElement('checkbox', 'reachend', get_string('completionreachend', 'mod_flexbook'));
        $mform->setType('reachend', PARAM_INT);

        $mform->addElement(
            'float',
            'completionpercentage',
            get_string('minimumcompletionpercentage', 'mod_flexbook'),
            ['size' => 5, 'regex' => '/^[0-9]{1,3}$/']
        );
        $mform->setType('completionpercentage', PARAM_INT);

        $buttonarray = [
            $mform->createElement('submit', 'savechanges', get_string('savechanges')),
            $mform->createElement('cancel', '', get_string('resettositedefaults', 'mod_interactivevideo')),
        ];
        $mform->addGroup($buttonarray, 'buttonar', '', [' '], false);
        $mform->closeHeaderBefore('buttonar');
    }

    /**
     * Validation.
     *
     * @param array $data
     * @param array $files
     * @return array
     */
    public function validation($data, $files) {
        return [];
    }

    /**
     * Get page url for dynamic submission.
     *
     * @return \moodle_url
     */
    protected function get_page_url_for_dynamic_submission(): \moodle_url {
        return new \moodle_url('/mod/flexbook/manage.php', [
            'courseid' => $this->optional_param('courseid', null, PARAM_INT),
            'tab' => 'settings',
        ]);
    }
}
