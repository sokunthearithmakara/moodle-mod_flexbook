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

/**
 * Manage Flexbook course-level interaction defaults (and course settings).
 *
 * @package    mod_flexbook
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require(__DIR__ . '/../../config.php');

$courseid = required_param('courseid', PARAM_INT);
$tab = optional_param('tab', 'defaults', PARAM_ALPHA);

require_course_login($courseid);
$course = get_course($courseid);
$coursecontext = context_course::instance($courseid);
require_capability('mod/flexbook:manage', $coursecontext);

$PAGE->set_url(new moodle_url('/mod/flexbook/manage.php', ['courseid' => $courseid, 'tab' => $tab]));
$PAGE->set_context($coursecontext);
$PAGE->set_title(get_string('managetitle', 'mod_flexbook'));
$PAGE->set_heading($course->fullname);
$PAGE->add_body_class('path-mod-interactivevideo');
$PAGE->add_body_class($CFG->branch >= 500 ? 'bs-5' : '');
$PAGE->set_pagelayout('incourse');
$PAGE->requires->css(new moodle_url('/mod/interactivevideo/libraries/bootstrap-icons/bootstrap-icons.min.css'));

// Build tabs.
$tabs = [];
$tabs[] = new tabobject(
    'defaults',
    new moodle_url('/mod/flexbook/manage.php', ['courseid' => $courseid, 'tab' => 'defaults']),
    get_string('interactiondefaults', 'mod_flexbook')
);
if (get_config('mod_flexbook', 'enablecoursesettings')) {
    $tabs[] = new tabobject(
        'settings',
        new moodle_url('/mod/flexbook/manage.php', ['courseid' => $courseid, 'tab' => 'settings']),
        get_string('settings', 'mod_flexbook')
    );
}

ob_start();
print_tabs([$tabs], $tab);
$tabmenu = ob_get_contents();
ob_end_clean();

echo $OUTPUT->header();
echo '<div class="container">' . $tabmenu . '</div>';

if ($tab === 'settings' && get_config('mod_flexbook', 'enablecoursesettings')) {
    $form = new \mod_flexbook\form\settings_form(
        null,
        null,
        'post',
        '',
        null,
        true,
        [
            'courseid' => $courseid,
            'contextid' => $coursecontext->id,
        ]
    );
    $form->set_data_for_dynamic_submission();
    echo '<div id="settings">';
    echo $form->render();
    echo '</div>';
    $PAGE->requires->js_call_amd('mod_flexbook/manage', 'settings', [
        $courseid,
        $coursecontext->id,
    ]);
} else if ($tab === 'defaults') {
    $activitytypes = \mod_flexbook\util::get_all_activitytypes();
    $typemap = [];
    foreach ($activitytypes as $activitytype) {
        $typemap[$activitytype['name']] = $activitytype;
    }
    $rows = [];
    foreach (\mod_flexbook\util::get_course_defaults($courseid) as $default) {
        $rows[] = [
            'type' => $default->type,
            'icon' => $typemap[$default->type]['icon'] ?? 'bi bi-cursor',
            'title' => $typemap[$default->type]['title'] ?? $default->type,
        ];
    }
    echo '<div class="container" id="defaults">';
    echo $OUTPUT->render_from_template('mod_flexbook/managedefaults', [
        'defaults' => $rows,
        'hasdefaults' => !empty($rows),
    ]);
    echo '</div>';
    $PAGE->requires->js_call_amd('mod_flexbook/manage', 'defaults', [
        $courseid,
        $coursecontext->id,
    ]);
}

echo $OUTPUT->footer();
