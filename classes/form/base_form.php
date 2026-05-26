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

/**
 * Class base_form
 *
 * @package    mod_flexbook
 * @copyright  2024 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class base_form extends \core_form\dynamic_form {
    /**
     * Returns form context
     *
     * If context depends on the form data, it is available in $this->_ajaxformdata or
     * by calling $this->optional_param()
     *
     * @return \context
     */
    protected function get_context_for_dynamic_submission(): \context {
        $contextid = $this->optional_param('contextid', null, PARAM_INT);
        return \context::instance_by_id($contextid, MUST_EXIST);
    }

    /**
     * Checks access for dynamic submission
     */
    protected function check_access_for_dynamic_submission(): void {
        require_capability('mod/flexbook:addinstance', $this->get_context_for_dynamic_submission());
    }

    /**
     * Sets data for dynamic submission
     */
    public function set_data_for_dynamic_submission(): void {
        $data = new \stdClass();
        $this->set_data($data);
    }

    /**
     * Sets default data for the form
     * Other forms can use this method to set default data
     *
     * @return \stdClass
     */
    public function set_data_default() {
        $data = new \stdClass();
        $data->id = $this->optional_param('id', 0, PARAM_RAW);
        $data->contextid = $this->optional_param('contextid', null, PARAM_INT);
        $data->courseid = $this->optional_param('courseid', null, PARAM_INT);
        $data->cmid = $this->optional_param('cmid', null, PARAM_INT);
        $data->annotationid = $this->optional_param('annotationid', null, PARAM_RAW);
        $data->contentform = $this->optional_param('content', '', PARAM_RAW);
        $data->iframeurl = $this->optional_param('iframeurl', '', PARAM_TEXT);
        $data->type = $this->optional_param('type', 'richtext', PARAM_TEXT);
        $data->contentid = $this->optional_param('contentid', null, PARAM_INT);
        $data->completiontracking = $this->optional_param('completiontracking', null, PARAM_TEXT);
        $data->xp = $this->optional_param('xp', null, PARAM_INT);
        $data->hascompletion = $this->optional_param('hascompletion', 0, PARAM_INT);
        $data->intg1 = $this->optional_param('intg1', null, PARAM_RAW);
        $data->intg2 = $this->optional_param('intg2', null, PARAM_RAW);
        $data->intg3 = $this->optional_param('intg3', null, PARAM_RAW);
        $data->char1 = $this->optional_param('char1', null, PARAM_RAW);
        $data->char2 = $this->optional_param('char2', null, PARAM_RAW);
        $data->char3 = $this->optional_param('char3', null, PARAM_RAW);
        $data->text1 = $this->optional_param('text1', '', PARAM_RAW);
        $data->text2 = $this->optional_param('text2', '', PARAM_RAW);
        $data->text3 = $this->optional_param('text3', '', PARAM_RAW);
        $data->requiremintime = $this->optional_param('requiremintime', 0, PARAM_INT);
        if ($data->completiontracking == 'view') {
            $data->requiremintimeview = $this->optional_param('requiremintime', 0, PARAM_INT);
            $data->requiremintime = 0;
        }
        $advancedsettings = json_decode($this->optional_param('advanced', null, PARAM_RAW));
        $data->timestamp = $this->optional_param('timestamp', 0, PARAM_FLOAT);
        $data->title = $this->optional_param('title', get_string('defaulttitle', 'mod_interactivevideo'), PARAM_TEXT);

        // Advanced settings: is a single field that contains all the advanced settings.
        if (is_object($advancedsettings)) {
            foreach ($advancedsettings as $key => $value) {
                $data->{$key} = $value;
            }
        }
        return $data;
    }

    /**
     * Get available annotation
     *
     * @param array $fitlers
     * @return array
     */
    public function get_annotations($fitlers = null) {
        $annotations = $this->optional_param('annotations', null, PARAM_RAW);
        if (!$annotations) {
            $jumpto = $this->optional_param('jumpto', null, PARAM_RAW);
            $jumptopass = $this->optional_param('jumptopass', null, PARAM_RAW);
            $jumptofail = $this->optional_param('jumptofail', null, PARAM_RAW);
            $backto = $this->optional_param('backto', null, PARAM_RAW);

            $jumpto = str_replace('@@ANNOID#', '', (string)$jumpto);
            $jumptopass = str_replace('@@ANNOID#', '', (string)$jumptopass);
            $jumptofail = str_replace('@@ANNOID#', '', (string)$jumptofail);
            $backto = str_replace('@@ANNOID#', '', (string)$backto);
            $return = [];
            if ($jumpto) {
                $return[$jumpto] = get_string('jumpto', 'mod_flexbook');
            }
            if ($jumptopass) {
                $return[$jumptopass] = get_string('jumptopass', 'mod_flexbook');
            }
            if ($jumptofail) {
                $return[$jumptofail] = get_string('jumptofail', 'mod_flexbook');
            }
            if ($backto) {
                $return[$backto] = get_string('backto', 'mod_flexbook');
            }
            return $return;
        }
        $annotations = json_decode($annotations, true);
        // Remove the current annotation.
        $annotations = array_filter($annotations, function ($annotation) {
            return (string)$annotation['id'] !== (string)$this->optional_param('id', null, PARAM_RAW);
        });
        if ($fitlers) {
            foreach ($fitlers as $key => $value) {
                $annotations = array_filter($annotations, function ($annotation) use ($key, $value) {
                    return $annotation[$key] == $value;
                });
            }
        }
        $return = [];
        $return['previousinteraction'] = get_string('previousinteraction', 'mod_flexbook');
        $return['nextinteraction'] = get_string('nextinteraction', 'mod_flexbook');
        $return['endscreen'] = get_string('endscreen', 'mod_flexbook');
        $return['firstpage'] = get_string('firstpage', 'mod_flexbook');

        foreach ($annotations as $annotation) {
            $return[(string)$annotation['id']] = $annotation['formattedtitle'];
        }
        return $return;
    }

    /**
     * Jump section fields
     * @param bool $hascompletion
     * @param bool $jumptopassfail
     * @return void
     */
    public function jump_section_fields($hascompletion = false, $jumptopassfail = false) {
        $mform = &$this->_form;
        $allannotations = $this->get_annotations() ?? [];
        $annotations = $allannotations;
        // These are handled by default '' values for jumpto and backto.
        unset($annotations['previousinteraction']);
        unset($annotations['nextinteraction']);

        $mform->addElement('hidden', 'annotations');
        $nextannotations = ['' => get_string('next', 'mod_flexbook')] + $annotations;
        $prevannotations = [
            '' => get_string('previous', 'mod_flexbook'),
            'previouslyviewed' => get_string('previouslyviewed', 'mod_flexbook'),
        ] + $annotations;
        $mform->addElement('header', 'jumpsection', get_string('navigation', 'mod_flexbook'));
        $mform->setExpanded('jumpsection', false);
        $mform->addElement('select', 'backto', get_string('backto', 'mod_flexbook'), $prevannotations);
        $mform->setType('backto', PARAM_RAW);
        $mform->addElement('select', 'jumpto', get_string('jumpto', 'mod_flexbook'), $nextannotations);
        $mform->setType('jumpto', PARAM_RAW);

        if ($hascompletion) {
            // Prevent skip: requires completion before jumping to the next annotation.
            $elements = [];
            $elements[] = $mform->createElement(
                'advcheckbox',
                'preventskip',
                '',
                get_string('preventskip', 'mod_flexbook'),
                ["group" => 1],
                [0, 1]
            );
            $elements[] = $mform->createElement(
                'advcheckbox',
                'locked',
                '',
                get_string('lockedtillcomplete', 'mod_flexbook'),
                ["group" => 1],
                [0, 1]
            );
            $elements[] = $mform->createElement(
                'static',
                'lockeddesc',
                '',
                '<span class="text-muted small w-100 d-block">'
                    . get_string('locked_desc', 'mod_flexbook') . '</span>'
            );
            $mform->addGroup($elements, 'lockedgroup', '', '', false);
            $mform->hideIf('lockedgroup', 'completiontracking', 'eq', 'none');

            if ($jumptopassfail) {
                // Jump to option on pass grade.
                $mform->addElement('select', 'jumptopass', get_string('jumptopass', 'mod_flexbook'), ['' => get_string('default')]
                    + $allannotations);
                $mform->setType('jumptopass', PARAM_RAW);

                // Jump to option on fail grade.
                $mform->addElement('select', 'jumptofail', get_string('jumptofail', 'mod_flexbook'), ['' => get_string('default')]
                    + $allannotations);
                $mform->setType('jumptofail', PARAM_RAW);

                // Hide if completion tracking is null or view or manual.
                $mform->hideIf('jumptofail', 'completiontracking', 'in', ['none', 'view', 'manual']);
                $mform->hideIf('jumptopass', 'completiontracking', 'in', ['none', 'view', 'manual']);
            }
        }
    }

    /**
     * Form definition
     */
    public function definition() {
        $mform = $this->_form;
    }

    /**
     * Pre processing data before saving to database
     *
     * @param \stdClass $data
     * @return \stdClass
     */
    public function pre_processing_data($data) {
        if (!isset($data->completiontracking) || $data->completiontracking == 'none') {
            $data->xp = 0;
            $data->hascompletion = 0;
        } else {
            $data->hascompletion = 1;
        }
        if ($data->completiontracking == 'view') {
            $data->requiremintime = $data->requiremintimeview;
        }
        return $data;
    }

    /**
     * Process data before returning to front end.
     *
     * @param \stdClass $fromform
     * @return \stdClass
     */
    public function data_post_processing($fromform) {
        global $DB;
        // We don't want to use $fromform because they are a bunch of other fields.
        $fromform = $DB->get_record('flexbook_items', ['id' => $fromform->id]);

        // Delete the cache, so it will be updated.
        $cache = \cache::make('mod_flexbook', 'fb_items');
        $cache->delete($fromform->cmid);

        $fromform->formattedtitle = format_string($fromform->title);
        return $fromform;
    }

    /**
     * Process dynamic submission
     *
     * @return \stdClass
     */
    public function process_dynamic_submission() {
        global $DB;
        // We're going to submit the data to database. If id is not 0, we're updating an existing record.
        $fromform = $this->get_data();
        $fromform = $this->pre_processing_data($fromform);
        $fromform->advanced = $this->process_advanced_settings($fromform);
        if ($fromform->id > 0) {
            $fromform->timemodified = time();
            $DB->update_record('flexbook_items', $fromform);
        } else {
            $fromform->timecreated = time();
            $fromform->timemodified = $fromform->timecreated;
            $fromform->id = $DB->insert_record('flexbook_items', $fromform);
        }

        $fromform = $this->data_post_processing($fromform);

        return $fromform;
    }

    /**
     * Process advanced settings
     *
     * @param \stdClass $data
     * @return string
     */
    public function process_advanced_settings($data) {
        $adv = new \stdClass();
        $properties = [
            'hideheader' => 0,
            'deletebeforecomplete' => 0,
            'deleteaftercomplete' => 0,
            'visiblebeforecompleted' => 1,
            'visibleaftercompleted' => 1,
            'clickablebeforecompleted' => 1,
            'clickableaftercompleted' => 1,
            'rerunbeforecompleted' => 0,
            'rerunaftercompleted' => 0,
            'removeaftercompletion' => 0,
            'removeafteractivitycompletion' => 0,
            'preventskip' => 0,
            'locked' => 0,
            'jumpto' => '',
            'jumptopass' => '',
            'jumptofail' => '',
            'backto' => '',
            'bottomheader' => 0,
            'instructions' => '',
            'hideinstructionsoncomplete' => 0,
        ];
        foreach ($properties as $key => $default) {
            $value = isset($data->{$key}) ? $data->{$key} : $default;
            // Add prefix for navigation fields.
            if (in_array($key, ['jumpto', 'jumptopass', 'jumptofail', 'backto']) && is_numeric($value) && $value > 0) {
                $value = '@@ANNOID#' . $value;
            }
            $adv->{$key} = $value;
        }

        return json_encode($adv);
    }

    /**
     * Used to set the form elements for the standard fields
     * @param bool $section Whether to add the General section header
     * that are common to all interactions
     */
    public function standard_elements($section = true) {
        $mform = &$this->_form;
        $attributes = $mform->getAttributes();
        $attributes['data-name'] = 'interaction-form';
        $mform->setAttributes($attributes);
        $mform->addElement('hidden', 'contextid', null);
        $mform->setType('contextid', PARAM_INT);

        $mform->addElement('hidden', 'type', null);
        $mform->setType('type', PARAM_TEXT);

        $mform->addElement('hidden', 'id', null);
        $mform->setType('id', PARAM_RAW);

        $mform->addElement('hidden', 'courseid', null);
        $mform->setType('courseid', PARAM_INT);

        $mform->addElement('hidden', 'cmid', null);
        $mform->setType('cmid', PARAM_INT);

        $mform->addElement('hidden', 'annotationid', null);
        $mform->setType('annotationid', PARAM_RAW);

        $mform->addElement('hidden', 'hascompletion', null);
        $mform->setType('hascompletion', PARAM_INT);

        if ($section) {
            $mform->addElement('header', 'general', get_string('general', 'form'));
        }
    }

    /**
     * Standard ompletion tracking field
     *
     * @param string $default
     * @param array $options
     * @return void
     */
    public function completion_tracking_field($default, $options = []) {
        $mform = &$this->_form;
        if (empty($options)) {
            $options = [
                'none' => get_string('completionnone', 'mod_interactivevideo'),
                'manual' => get_string('completionmanual', 'mod_interactivevideo'),
                'view' => get_string('completiononview', 'mod_interactivevideo'),
            ];
        }
        $this->render_dropdown(
            'completiontracking',
            '<i class="bi bi-check2-square iv-mr-2"></i>' . get_string('completiontracking', 'mod_interactivevideo'),
            $options
        );
        $mform->setType('completiontracking', PARAM_TEXT);
        $mform->setDefault('completiontracking', $default);
        $mform->addElement(
            'text',
            'requiremintime',
            '<i class="bi bi-clock iv-mr-2"></i>' . get_string('requiremintime', 'mod_interactivevideo')
        );
        $mform->setType('requiremintime', PARAM_INT);
        $mform->setDefault('requiremintime', 0);
        $mform->addRule('requiremintime', null, 'numeric', null, 'client');
        $mform->hideIf('requiremintime', 'completiontracking', 'neq', 'manual');
        $mform->addHelpButton('requiremintime', 'requiremintime', 'mod_interactivevideo');

        $mform->addElement(
            'text',
            'requiremintimeview',
            '<i class="bi bi-clock iv-mr-2"></i>' . get_string('requiremintime', 'mod_interactivevideo')
        );
        $mform->setType('requiremintimeview', PARAM_INT);
        $mform->setDefault('requiremintimeview', 0);
        $mform->addRule('requiremintimeview', null, 'numeric', null, 'client');
        $mform->hideIf('requiremintimeview', 'completiontracking', 'neq', 'view');
        $mform->addHelpButton('requiremintimeview', 'requiremintime', 'mod_interactivevideo');
    }

    /**
     * XP field
     *
     * @param int $xp default value
     * @return void
     */
    public function xp_form_field($xp = 0) {
        $mform = &$this->_form;
        $mform->addElement('text', 'xp', '<i class="bi bi-star iv-mr-2"></i>' . get_string('xp', 'mod_interactivevideo'));
        $mform->setType('xp', PARAM_INT);
        $mform->addRule('xp', null, 'numeric', null, 'client');
        $mform->setDefault('xp', $xp);
    }

    /**
     * Advanced form fields
     *
     * @param array $options
     * @return void
     */
    public function advanced_form_fields($options = []) {
        // Normalize options.
        $options += [
            'title' => true, // Whether to show title field.
            'hascompletion' => false, // Whether the interaction has completion tracking.
            'visibility' => true, // Whether to show visibility options.
            'click' => true, // Whether to show clickability options.
            'rerun' => true, // Whether the interaction starts fresh when re-launch.
            'remove' => true, // Whether to remove the interaction from the list after completion.
        ];

        $mform = &$this->_form;

        $mform->addElement('header', 'advanced', get_string('advanced', 'mod_interactivevideo'));
        // Collapse the advanced fields by default.
        $mform->setExpanded('advanced', false);

        $mform->addElement(
            'textarea',
            'instructions',
            get_string('instructions', 'mod_flexbook'),
            ['rows' => 3, 'class' => 'w-100']
        );
        $mform->addHelpButton('instructions', 'instructions', 'mod_flexbook');
        $mform->setType('instructions', PARAM_TEXT);

        $mform->addElement(
            'advcheckbox',
            'hideinstructionsoncomplete',
            get_string('hideinstructionsoncomplete', 'mod_flexbook'),
            get_string('hideinstructionsoncomplete_desc', 'mod_flexbook')
        );
        $mform->setType('hideinstructionsoncomplete', PARAM_INT);

        if ($options['title']) {
            // Hide interaction title.
            $elementarray = [];
            $elementarray[] = $mform->createElement(
                'advcheckbox',
                'hideheader',
                '',
                get_string('hidetitle', 'mod_flexbook'),
                ["group" => 1],
                [0, 1]
            );
            $elementarray[] = $mform->createElement(
                'advcheckbox',
                'bottomheader',
                '',
                get_string('headerbottom', 'mod_flexbook'),
                ["group" => 1],
                [0, 1]
            );
            $elementarray[] = $mform->createElement(
                'static',
                'hideheaderdesc',
                '',
                '<span class="text-muted small w-100 d-block">'
                    . get_string('hidetitle_desc', 'mod_flexbook') . ' '
                    . get_string('headerbottom_desc', 'mod_flexbook') . '</span>'
            );

            $mform->addGroup($elementarray, '', get_string('interactiontitle', 'mod_flexbook'));
        }

        // Delete completion data.
        if ($options['hascompletion']) {
            $elementarray = [];
            $elementarray[] = $mform->createElement(
                'advcheckbox',
                'deletebeforecomplete',
                '',
                get_string('beforeactivitycompletion', 'mod_flexbook'),
                ["group" => 1],
                [0, 1]
            );
            $elementarray[] = $mform->createElement(
                'advcheckbox',
                'deleteaftercomplete',
                '',
                get_string('afteractivitycompletion', 'mod_flexbook'),
                ["group" => 1],
                [0, 1]
            );
            $elementarray[] = $mform->createElement(
                'static',
                'deletecompletion',
                '',
                '<span class="text-muted small w-100 d-block">'
                    . get_string('deletecompletiondesc', 'mod_flexbook') . '</span>'
            );
            $mform->addGroup($elementarray, '', get_string('deletecompletion', 'mod_interactivevideo'));
        }

        if ($options['visibility']) {
            $elementarray = [];

            $elementarray[] = $mform->createElement(
                'advcheckbox',
                'visiblebeforecompleted',
                '',
                $options['hascompletion'] ?
                    get_string('beforecompletion', 'mod_interactivevideo') : get_string('yes'),
                ["group" => 1],
                [0, 1]
            );

            if ($options['hascompletion']) {
                $elementarray[] = $mform->createElement(
                    'advcheckbox',
                    'visibleaftercompleted',
                    '',
                    get_string('aftercompletion', 'mod_interactivevideo'),
                    ["group" => 1],
                    [0, 1]
                );
            }
            $elementarray[] = $mform->createElement(
                'static',
                'visibilityonnav',
                '',
                '<span class="text-muted small w-100 d-block">'
                    . get_string('visibilityonnav_desc', 'mod_flexbook') . '</span>'
            );

            $mform->addGroup($elementarray, '', get_string('visibilityonnav', 'mod_flexbook'));

            $mform->setDefault('visiblebeforecompleted', 1);
            $mform->setDefault('visibleaftercompleted', 1);
        }

        if ($options['click']) {
            $elementarray = [];

            $elementarray[] = $mform->createElement(
                'advcheckbox',
                'clickablebeforecompleted',
                '',
                $options['hascompletion'] ?
                    get_string('beforecompletion', 'mod_interactivevideo') : get_string('yes'),
                ["group" => 1],
                [0, 1]
            );

            if ($options['hascompletion']) {
                $elementarray[] = $mform->createElement(
                    'advcheckbox',
                    'clickableaftercompleted',
                    '',
                    get_string('aftercompletion', 'mod_interactivevideo'),
                    ["group" => 1],
                    [0, 1]
                );
            }
            $elementarray[] = $mform->createElement(
                'static',
                'clickability',
                '',
                '<span class="text-muted small w-100 d-block">'
                    . get_string('clickability_desc', 'mod_flexbook') . '</span>'
            );
            $mform->addGroup($elementarray, '', get_string('clickability', 'mod_interactivevideo'));
            $mform->setDefault('clickablebeforecompleted', 1);
            $mform->setDefault('clickableaftercompleted', 1);
        }

        if ($options['rerun']) {
            $elementarray = [];

            $elementarray = [];

            $elementarray[] = $mform->createElement(
                'advcheckbox',
                'rerunbeforecompleted',
                '',
                $options['hascompletion'] ?
                    get_string('beforecompletion', 'mod_interactivevideo') : get_string('yes'),
                ["group" => 1],
                [0, 1]
            );

            if ($options['hascompletion']) {
                $elementarray[] = $mform->createElement(
                    'advcheckbox',
                    'rerunaftercompleted',
                    '',
                    get_string('aftercompletion', 'mod_interactivevideo'),
                    ["group" => 1],
                    [0, 1]
                );
            }
            $elementarray[] = $mform->createElement(
                'static',
                'rerun',
                '',
                '<span class="text-muted small w-100 d-block">'
                    . get_string('rerun_desc', 'mod_flexbook') . '</span>'
            );
            $mform->addGroup($elementarray, '', get_string('rerun', 'mod_flexbook'));
            $mform->setDefault('rerunbeforecompleted', 0);
            $mform->setDefault('rerunaftercompleted', 0);
        }

        if ($options['remove']) {
            $elementarray = [];
            $elementarray[] = $mform->createElement(
                'advcheckbox',
                'removeaftercompletion',
                '',
                get_string('aftercompletion', 'mod_interactivevideo'),
                ["group" => 1],
                [0, 1]
            );
            $elementarray[] = $mform->createElement(
                'advcheckbox',
                'removeafteractivitycompletion',
                '',
                get_string('afteractivitycompletion', 'mod_flexbook'),
                ["group" => 1],
                [0, 1]
            );
            $elementarray[] = $mform->createElement(
                'static',
                'removeafteractivitycompletiondesc',
                '',
                '<span class="text-muted small w-100 d-block">'
                    . get_string('removal_desc', 'mod_flexbook') . '</span>'
            );
            $mform->addGroup($elementarray, '', get_string('removal', 'mod_flexbook'));
        }
    }

    /**
     * Add interaction fields (Go to URL, Go to Interaction, Play Audio)
     *
     * @param array $options Options to control which interaction types are available.
     * @return void
     */
    public function interaction_fields($options = []) {
        $options += [
            'gotourl' => true,
            'gotointeraction' => true,
            'playaudio' => true,
        ];

        $mform = &$this->_form;
        $mform->addElement('header', 'interactionheader', get_string('interaction', 'local_fbcanvas'));

        $typeoptions = ['none' => get_string('none', 'local_fbcanvas')];
        if ($options['gotourl']) {
            $typeoptions['gotourl'] = get_string('gotourl', 'local_fbcanvas');
        }
        if ($options['gotointeraction']) {
            $typeoptions['gotointeraction'] = get_string('gotointeraction', 'local_fbcanvas');
        }
        if ($options['playaudio']) {
            $typeoptions['playaudio'] = get_string('playaudio', 'local_fbcanvas');
        }

        $mform->addElement('select', 'interactiontype', get_string('interactiontype', 'local_fbcanvas'), $typeoptions);
        $mform->setDefault('interactiontype', 'none');

        if ($options['gotourl']) {
            $mform->addElement('text', 'gotourl', get_string('gotourl', 'local_fbcanvas'), ['size' => 100]);
            $mform->setType('gotourl', PARAM_URL);
            $mform->addRule(
                'gotourl',
                get_string('invalidurlformat', 'local_fbcanvas'),
                'regex',
                "/\b(?:(?:https?|ftp):\/\/|www\.)[-a-z0-9+&@#\/%?=~_|!:,.;]*\.[a-z]{2,}[-a-z0-9+&@#\/%=~_|]*/i",
                'client'
            );
            $mform->hideIf('gotourl', 'interactiontype', 'neq', 'gotourl');
        }

        if ($options['gotointeraction']) {
            $annotationoptions = [0 => get_string('none', 'local_fbcanvas')] + ($this->get_annotations() ?? []);
            $mform->addElement('select', 'gotointeraction', get_string('gotointeraction', 'local_fbcanvas'), $annotationoptions);
            $mform->setType('gotointeraction', PARAM_RAW);
            $mform->hideIf('gotointeraction', 'interactiontype', 'neq', 'gotointeraction');
        }

        if ($options['playaudio']) {
            global $COURSE;
            $filemanageroptions = [
                'maxbytes'       => $COURSE->maxbytes,
                'subdirs'        => 0,
                'maxfiles'       => 1,
                'accepted_types' => ['html_audio'],
            ];
            $mform->addElement('filemanager', 'audio', get_string('audiofile', 'local_fbcanvas'), null, $filemanageroptions);
            $mform->hideIf('audio', 'interactiontype', 'neq', 'playaudio');
        }
    }

    /**
     * Standard close form element
     *
     * @return void
     */
    public function close_form() {
        $mform = &$this->_form;
        $mform->addElement('static', 'buttonar', '');
        $mform->closeHeaderBefore('buttonar');
        $this->set_display_vertical();
    }

    /**
     * Validation
     *
     * @param array $data
     * @param array $files
     * @return array
     */
    public function validation($data, $files) {
        $errors = parent::validation($data, $files);

        if (isset($data['interactiontype'])) {
            $type = $data['interactiontype'];
            if ($type === 'gotourl') {
                if (empty($data['gotourl'])) {
                    $errors['gotourl'] = get_string('required');
                }
            } else if ($type === 'playaudio') {
                if (empty($data['audio'])) {
                    $errors['audio'] = get_string('required');
                } else {
                    $usercontext = \context_user::instance($GLOBALS['USER']->id);
                    $fs = get_file_storage();
                    $draftfiles = $fs->get_area_files($usercontext->id, 'user', 'draft', $data['audio'], 'id', false);
                    if (count($draftfiles) == 0) {
                        $errors['audio'] = get_string('required');
                    }
                }
            }
        }

        return $errors;
    }

    /**
     * Editor options
     *
     * @return array
     */
    public function editor_options() {
        global $COURSE;
        return [
            'maxbytes' => $COURSE->maxbytes,
            'maxfiles' => EDITOR_UNLIMITED_FILES,
            'changeformat' => 1,
            'noclean' => 1,
            'context' => $this->get_context_for_dynamic_submission(),
        ];
    }

    /**
     * Render select dropdown based on Moodle version.
     *
     * @param string $name
     * @param string $label
     * @param mixed $opts
     * @param array $attributes
     * @return void
     */
    public function render_dropdown($name, $label, $opts, $attributes = []) {
        $mform = &$this->_form;
        // Originally, we wanted to use the new dropdown in 4.4, but it looks ugly, so we'll stick with the old one.
        // Keeping it here now in case we want to switch back.
        $mform->addElement('select', $name, $label, $opts, $attributes);
    }

    /**
     * Returns page URL for dynamic submission
     *
     * @return \moodle_url
     */
    protected function get_page_url_for_dynamic_submission(): \moodle_url {
        return new \moodle_url('/mod/flexbook/view.php', [
            'id' => $this->optional_param('id', null, PARAM_RAW),
        ]);
    }
}
