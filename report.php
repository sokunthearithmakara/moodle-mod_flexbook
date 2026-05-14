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
 * TODO describe file report
 *
 * @package    mod_flexbook
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require(__DIR__ . '/../../config.php');

$id = required_param('id', PARAM_INT); // Course_module ID.
$cm = get_coursemodule_from_id('flexbook', $id, 0, false, MUST_EXIST);
$course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);

require_login($course, false, $cm);

$group = optional_param('group', 0, PARAM_INT);
$moduleinstance = $DB->get_record('flexbook', ['id' => $cm->instance], '*', MUST_EXIST);
$context = \context_module::instance($cm->id);

// 1. Access and Page Setup.
\mod_interactivevideo\report_helper::validate_access('mod_flexbook', $context, $course, $cm);

// Get content types for requirements setup.
$contenttypes = \mod_flexbook\util::get_all_activitytypes();
\mod_interactivevideo\report_helper::setup_page_requirements(
    $moduleinstance,
    'mod_flexbook',
    $cm,
    $course,
    $context,
    $contenttypes
);

// 2. Data Preparation.
$reportdata = \mod_interactivevideo\report_helper::get_standard_report_items(
    'mod_flexbook',
    $moduleinstance,
    '\\mod_flexbook\\util',
    $context,
    $cm
);
$items = $reportdata['items'];
$allitems = $reportdata['allitems'];
$data = \mod_interactivevideo\report_helper::prepare_template_data('mod_flexbook', $cm, $moduleinstance, $course, $context, $items);

echo $OUTPUT->header();
echo $OUTPUT->render_from_template('mod_flexbook/pagenav', $data['pagenav']);

// Add containers data (module specific).
$data['reporttable']['containers'] = [
    ['id' => 'itemsdata', 'content' => json_encode($allitems)],
    ['id' => 'doptions', 'content' => json_encode($moduleinstance->displayoptions)],
    ['id' => 'contenttypes', 'content' => json_encode($contenttypes)],
];
$data['reporttable']['moodleversion'] = $CFG->branch;

echo $OUTPUT->render_from_template('mod_flexbook/reporttable', $data['reporttable']);

$PAGE->requires->js_call_amd('mod_flexbook/report', "init", [[
    'cmid' => $cm->id,
    'flexbook' => $cm->instance,
    'groupid' => $group,
    'grademax' => $moduleinstance->grade,
    'itemids' => array_column($items, 'id'),
    'completionpercentage' => $moduleinstance->completionpercentage,
    'courseid' => $course->id,
    'name' => format_string($moduleinstance->name),
    'access' => [
        'canedit' => has_capability('mod/flexbook:editreport', $context),
        'canview' => has_capability('mod/flexbook:viewreport', $context),
    ],
    'iseditor' => has_capability('mod/flexbook:edit', $context) ? true : false,
]]);

echo $OUTPUT->footer();
