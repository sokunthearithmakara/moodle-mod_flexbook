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

defined('MOODLE_INTERNAL') || die();

require_once($CFG->dirroot . '/course/moodleform_mod.php');

/**
 * Form for adding and editing Flexbook instances
 *
 * @package    mod_flexbook
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class mod_flexbook_mod_form extends moodleform_mod {
    /**
     * Plugins with mform.
     *
     * @var array
     */
    public $subplugins = [];

    /**
     * Constructor for the mod_flexbook_mod_form class.
     *
     * @param \stdClass $current
     * @param \stdClass $section
     * @param \stdClass $cm
     * @param \stdClass $course
     */
    public function __construct($current, $section, $cm, $course) {
        $allsubplugins = explode(',', get_config('mod_flexbook', 'enablecontenttypes'));
        $subpluginclass = [];
        foreach ($allsubplugins as $subplugin) {
            $class = $subplugin . '\\fbmform';
            if (class_exists($class)) {
                $subpluginclass[] = $class;
            }
        }
        $this->subplugins = $subpluginclass;
        parent::__construct($current, $section, $cm, $course);
    }

    /**
     * Defines forms elements
     *
     * @return void
     */
    public function definition() {
        global $CFG, $PAGE;
        $PAGE->add_body_class('path-mod-interactivevideo');
        $bsaffix = $CFG->branch >= 500 ? '-bs' : '';
        $current = $this->current;

        $mform = $this->_form;

        // General fieldset.
        $mform->addElement('header', 'general', get_string('general', 'form'));

        $mform->addElement('text', 'name', get_string('name'), ['size' => '64']);
        $mform->setType('name', empty($CFG->formatstringstriptags) ? PARAM_CLEANHTML : PARAM_TEXT);
        $mform->addRule('name', null, 'required', null, 'client');
        $mform->addRule('name', get_string('maximumchars', '', 255), 'maxlength', 255, 'client');

        if (!empty($this->_features->introeditor)) {
            // Description element that is usually added to the General fieldset.
            $this->standard_intro_elements();
        }

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

        // End screen text.
        $mform->addElement(
            'editor',
            'endscreentext',
            get_string('endscreentext', 'mod_flexbook'),
            null,
            ['maxfiles' => EDITOR_UNLIMITED_FILES, 'noclean' => true]
        );
        $mform->setType('endscreentext', PARAM_RAW);

        $mform->addElement('hidden', 'type', 'page');
        $mform->setType('type', PARAM_TEXT);
        $mform->setDefault('type', 'page');

        // APPEARANCE AND BEHAVIOR SETTINGS.
        $mform->addElement('header', 'videodisplayoptions', get_string('appearanceandbehaviorsettings', 'mod_flexbook'));

        flexbook_appearanceandbehavior_form($mform, $current);

        // Additional settings from external plugins.
        if (!empty($this->subplugins)) {
            $mform->addElement('header', 'additionalsettings', get_string('additionalsettings', 'mod_flexbook'));
            $count = 0;
            foreach ($this->subplugins as $plugin) {
                if (method_exists($plugin, 'definition')) {
                    $additionalfields = $plugin::definition($mform, $current); // Should return true if it has added fields.
                    $count += $additionalfields ? 1 : 0;
                }
            }
            if ($count == 0) {
                $mform->removeElement('additionalsettings');
            }
        }

        // Other standard elements that are displayed in their own fieldsets.
        $this->standard_grading_coursemodule_elements();
        $this->standard_coursemodule_elements();

        $this->add_action_buttons();

        $PAGE->requires->js_init_code('window.M.version = ' . $CFG->branch . ';', true);
    }

    /**
     * Custom completion rules should be added here
     *
     * @return array Contains the names of the added form elements
     */
    public function add_completion_rules() {
        global $CFG;
        $bsaffix = $CFG->branch >= 500 ? '-bs' : '';
        $mform = $this->_form;
        $suffix = '';
        if (method_exists($this, 'get_suffix')) {
            $suffix = $this->get_suffix();
        }
        $group = [];
        $completionpercentageenabledel = 'completionpercentageenabled' . $suffix;
        $group[] = &$mform->createElement(
            'checkbox',
            $completionpercentageenabledel,
            '',
            get_string('minimumcompletionpercentage', 'mod_flexbook')
        );
        $completionpercentageel = 'completionpercentage' . $suffix;
        $group[] = &$mform->createElement('text', $completionpercentageel, '', ['size' => 3]);
        $mform->setType($completionpercentageel, PARAM_INT);
        $group[] = &$mform->createElement(
            'html',
            "<span class=\"btn\" data$bsaffix-html=\"true\" data$bsaffix-toggle=\"tooltip\" "
                . "data$bsaffix-placement=\"right\" data$bsaffix-title=\""
                . get_string('completionpercentagehelp', 'mod_flexbook')
                . "\"><i class=\"fa fa-circle-question\"></i></span>"
        );
        $completionpercentagegroupel = 'completionpercentagegroup' . $suffix;
        $mform->addGroup($group, $completionpercentagegroupel, '', ' ', false);
        $mform->disabledIf($completionpercentageel, $completionpercentageenabledel, 'notchecked');

        $group = [];
        $group[] = &$mform->createElement(
            'checkbox',
            'reachend' . $suffix,
            '',
            get_string('completionreachend', 'mod_flexbook')
        );
        $mform->setType('reachend' . $suffix, PARAM_INT);
        $mform->addGroup($group, 'completionreachendgroup' . $suffix, '', ' ', false);

        $return = [$completionpercentagegroupel, 'completionreachendgroup' . $suffix];
        // Get other elements from plugins.
        foreach ($this->subplugins as $class) {
            if (!method_exists($class, 'customcompletion_definition')) {
                continue;
            }
            try {
                $els = $class::customcompletion_definition($mform, $suffix);
                $return = array_merge($return, $els);
            } catch (Exception $e) {
                continue;
            }
        }
        return $return;
    }

    /**
     * Determines if completion is enabled for this module.
     *
     * @param array $data The data from the form.
     * @return bool True if completion is enabled.
     */
    public function completion_rule_enabled($data) {
        $hascompletion = false;
        $suffix = '';
        if (method_exists($this, 'get_suffix')) {
            $suffix = $this->get_suffix();
        }
        // Default completion.
        if (isset($data['completionpercentageenabled' . $suffix]) && $data['completionpercentage' . $suffix] > 0) {
            $hascompletion = true;
        }

        // Reach end completion.
        if (isset($data['reachend' . $suffix]) && $data['reachend' . $suffix] == 1) {
            $hascompletion = true;
        }

        // Get other elements from plugins that extends ivhascompletion.
        foreach ($this->subplugins as $class) {
            if (!method_exists($class, 'completion_rule_enabled')) {
                continue;
            }
            try {
                $hascompletion = $class::completion_rule_enabled($data, $suffix) ? true : $hascompletion;
            } catch (Exception $e) {
                continue;
            }
        }
        return $hascompletion;
    }

    /**
     * Prepare data before applying to populating form.
     *
     * @param array $defaultvalues The default values.
     * @return void
     */
    public function data_preprocessing(&$defaultvalues) {
        if ($this->current->instance) {
            $suffix = '';
            if (method_exists($this, 'get_suffix')) {
                $suffix = $this->get_suffix();
            }
            // Handle end screen.
            $text = $defaultvalues['endscreentext'] ?? '';
            $defaultvalues['endscreentext'] = [];
            $draftitemid = file_get_submitted_draft_itemid('endscreentext');
            $defaultvalues['endscreentext']['format'] = FORMAT_HTML;
            $defaultvalues['endscreentext']['itemid'] = $draftitemid;
            $defaultvalues['endscreentext']['text'] = file_prepare_draft_area(
                $draftitemid,
                $this->context->id,
                'mod_flexbook',
                'endscreentext',
                0,
                ['subdirs' => 0],
                $text
            );

            // Handle display options.
            $displayoptions = [
                'showdescriptiononheader',
                'darkmode',
                'theme',
                'distractionfreemode',
                'courseindex',
                'beforecompletion',
                'aftercompletion',
                'beforecompletionbehavior',
                'aftercompletionbehavior',
                'aspectratio',
                'duolingotheme',
            ];
            if (empty($defaultvalues['displayoptions'])) {
                $defaultvalues['displayoptions'] = json_encode(array_fill_keys($displayoptions, 0));
            }
            $defaultdisplayoptions = json_decode($defaultvalues['displayoptions'], true);
            foreach ($displayoptions as $option) {
                $defaultvalues[$option] = !empty($defaultdisplayoptions[$option]) ? $defaultdisplayoptions[$option] : 0;
                if ($option == 'theme' && empty($defaultvalues[$option])) {
                    $defaultvalues[$option] = '';
                }
                if (
                    in_array($option, [
                        'beforecompletion',
                        'aftercompletion',
                        'beforecompletionbehavior',
                        'aftercompletionbehavior',
                    ]) && $defaultvalues[$option] == 0
                ) {
                    $defaultvalues[$option] = [];
                }
            }

            // Handle completion requirements.
            $defaultvalues['completionpercentageenabled' . $suffix] =
                !empty($defaultvalues['completionpercentage' . $suffix]) ? 1 : 0;
            if (empty($defaultvalues['completionpercentage' . $suffix])) {
                $defaultvalues['completionpercentage' . $suffix] = 0;
            }

            // Reach end completion.
            if (isset($defaultvalues['extendedcompletion'])) {
                $customcompletion = json_decode($defaultvalues['extendedcompletion'], true);
                if (isset($customcompletion['reachend']) && $customcompletion['reachend'] == 1) {
                    $defaultvalues['reachend' . $suffix] = 1;
                } else {
                    $defaultvalues['reachend' . $suffix] = 0;
                }
            } else {
                $defaultvalues['reachend' . $suffix] = 0;
            }

            // Handle subplugin.
            foreach ($this->subplugins as $plugin) {
                if (!method_exists($plugin, 'data_preprocessing')) {
                    continue;
                }
                try {
                    $plugin::data_preprocessing($defaultvalues, $suffix);
                } catch (Exception $e) {
                    continue;
                }
            }
        } else {
            // New instance, set defaults from site settings.
            $defaultappearance = get_config('mod_flexbook', 'defaultappearance');
            $defaultappearance = !empty($defaultappearance) ? explode(',', $defaultappearance) : [
                'distractionfreemode',
                'darkmode',
                'courseindex',
                'controlbar',
                'interactionbar',
                'chaptertoggle',
            ];

            foreach ($defaultappearance as $option) {
                $defaultvalues[$option] = 1;
            }

            $defaultbehavior = flexbook_default_behavior();
            $defaultvalues['beforecompletionbehavior'] = $defaultbehavior;
            $defaultvalues['aftercompletionbehavior'] = $defaultbehavior;

            $defaultvalues['theme'] = get_config('mod_flexbook', 'defaulttheme') ?? '';
            $defaultvalues['aspectratio'] = get_config('mod_flexbook', 'defaultaspectratio') ?? '';
        }
    }

    /**
     * Custom data should be added here
     *
     * @param \stdClass $data The data from the form.
     * @return void
     */
    public function data_postprocessing($data) {
        $suffix = '';
        if (method_exists($this, 'get_suffix')) {
            $suffix = $this->get_suffix();
        }
        if (!empty($data->completionunlocked)) {
            $completion = isset($data->{'completion'}) ? $data->{'completion'} : 0;
            $autocompletion = !empty($completion) && $completion == COMPLETION_TRACKING_AUTOMATIC;
            if ($autocompletion) {
                if (empty($data->{'completionpercentageenabled' . $suffix}) && $autocompletion) {
                    $data->{'completionpercentage'} = 0;
                }

                $customcompletion = [];
                // Reach end completion.
                if (isset($data->{'reachend' . $suffix}) && $data->{'reachend' . $suffix} == 1) {
                    $customcompletion['reachend'] = 1;
                }
                foreach ($this->subplugins as $class) {
                    if (!method_exists($class, 'data_postprocessing')) {
                        continue;
                    }
                    try {
                        $customcompletion = $class::data_postprocessing($data, $customcompletion, $suffix);
                    } catch (Exception $e) {
                        continue;
                    }
                }

                $data->{'extendedcompletion'} = json_encode($customcompletion);
            } else {
                $data->{'extendedcompletion'} = '';
            }
        }
    }
}
