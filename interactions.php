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
 * TODO describe file interactions
 *
 * @package    mod_flexbook
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require(__DIR__ . '/../../config.php');

// Course module id.
$id = optional_param('id', 0, PARAM_INT);

// Activity instance id.
$i = optional_param('i', 0, PARAM_INT);

if ($id) {
    $cm = get_coursemodule_from_id('flexbook', $id, 0, false, MUST_EXIST);
    $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
    $moduleinstance = $DB->get_record('flexbook', ['id' => $cm->instance], '*', MUST_EXIST);
} else {
    $moduleinstance = $DB->get_record('flexbook', ['id' => $i], '*', MUST_EXIST);
    $course = $DB->get_record('course', ['id' => $moduleinstance->course], '*', MUST_EXIST);
    $cm = get_coursemodule_from_instance('flexbook', $moduleinstance->id, $course->id, false, MUST_EXIST);
}

require_login($course, true, $cm);
if ($moduleinstance->displayoptions) {
    $moduleinstance->displayoptions = json_decode($moduleinstance->displayoptions, true);
} else {
    $moduleinstance->displayoptions = [];
}
if (isset($moduleinstance->displayoptions['theme']) && $moduleinstance->displayoptions['theme'] != '') {
    $PAGE->force_theme($moduleinstance->displayoptions['theme']);
}
$modulecontext = context_module::instance($cm->id);

// Check if the user has capability to edit the interactions.
if (!has_capability('mod/flexbook:edit', $modulecontext)) {
    redirect(
        new moodle_url('/course/view.php', ['id' => $course->id]),
        get_string('nopermissiontoaddinteractions', 'mod_interactivevideo'),
        null,
        \core\output\notification::NOTIFY_ERROR
    );
}
// Prepare strings for js files using string manager.
$stringman = get_string_manager();
$contentoptions = \mod_flexbook\util::get_all_activitytypes();
foreach ($contentoptions as $contentoption) {
    $stringcomponent = $contentoption['stringcomponent'];
    $strings = $stringman->load_component_strings($stringcomponent, current_language());
    $PAGE->requires->strings_for_js(array_keys($strings), $stringcomponent);
}

$strings = $stringman->load_component_strings('mod_flexbook', current_language());
$PAGE->requires->strings_for_js(array_keys($strings), 'mod_flexbook');
$PAGE->requires->jquery_plugin('ui-css');
$PAGE->activityheader->disable();

$PAGE->set_url('/mod/flexbook/interactions.php', ['id' => $cm->id]);
$PAGE->set_title(get_string('interactionsin', 'interactivevideo', format_string($moduleinstance->name)));
$PAGE->set_heading(format_string($course->fullname));
$PAGE->set_context($modulecontext);
$PAGE->set_pagelayout('embedded');
$PAGE->add_body_class('path-mod-interactivevideo page-interactions distraction-free ' . $moduleinstance->type . ($CFG->branch >= 500 ? ' bs-5' : ''));
$PAGE->requires->js_init_code('window.M.version = ' . $CFG->branch . ';', true);

// Sort the content types by title.
usort($contentoptions, function ($a, $b) {
    return strcmp($a['title'], $b['title']);
});

$coursecontext = context_course::instance($course->id);

// Check if the flexbook is attempted by users.
$attempted = $DB->record_exists_select('flexbook_completion', 'cmid = ? AND completionpercentage > 0 ', [$cm->id]);

// Use Bootstrap icons instead of fontawesome icons to avoid issues fontawesome icons support in Moodle 4.1.
$PAGE->requires->css(new moodle_url('/mod/interactivevideo/libraries/bootstrap-icons/bootstrap-icons.min.css'));

echo $OUTPUT->header();

$primary = new core\navigation\output\primary($PAGE);
$renderer = $PAGE->get_renderer('core');
$primarymenu = $primary->export_for_template($renderer);

$bs = $CFG->branch >= 500 ? '-bs' : '';

// Display page navigation.
// Understanding the course format: singlepage or multiplepages.
$format = course_get_format($course);
if (
    $format->get_course_display() == COURSE_DISPLAY_MULTIPAGE &&
    !$format->show_editor()
) {
    if ($CFG->branch >= 404) { // Section.php started to exist in Moodle 4.4.
        $returnurl = new moodle_url('/course/section.php', [
            'id' => $cm->section,
        ]);
    } else {
        $modinfo = get_fast_modinfo($course);
        $returnurl = new moodle_url('/course/view.php', [
            'id' => $course->id,
            'section' => $modinfo->get_cm($cm->id)->sectionnum,
        ]);
    }
} else {
    $returnurl = new moodle_url('/course/view.php', ['id' => $course->id]);
}

$courseindex = isset($moduleinstance->displayoptions['courseindex']) && $moduleinstance->displayoptions['courseindex'] ?
    core_course_drawer() : '';
$hascourseindex = !empty($courseindex);
$datafortemplate = [
    "cmid" => $cm->id,
    "instance" => $cm->instance,
    "contextid" => $modulecontext->id,
    "courseid" => $course->id,
    "returnurl" => $returnurl,
    "canedit" => has_capability('mod/flexbook:edit', $modulecontext),
    "completion" => ($attempted ? '<span class="mb-0 iv-border-left border-danger iv-pl-3 iv-ml-2"><button class="btn btn-sm"
          type="button" data' . $bs . '-toggle="popover" data' . $bs . '-html="true" data' . $bs . '-content=\'' .
        get_string('interactionscannotbeedited', 'mod_interactivevideo') . '\'>
         <i class="bi bi-exclamation-circle-fill text-warning fs-25px"></i></button></span>' : ''),
    "manualcompletion" => 1,
    "settingurl" => has_capability('mod/flexbook:edit', $modulecontext)
        ? new moodle_url('/course/modedit.php', ['update' => $cm->id]) : '',
    "reporturl" => has_capability('mod/flexbook:viewreport', $modulecontext)
        ? new moodle_url('/mod/flexbook/report.php', ['id' => $cm->id]) : '',
    "interactionsurl" => '',
    "useravatar" => $primarymenu['user'],
    "viewurl" => new moodle_url('/mod/flexbook/view.php', ['id' => $cm->id]),
    "backupurl" => has_capability('moodle/backup:backupactivity', $modulecontext) ? new moodle_url(
        '/backup/backup.php',
        ['cm' => $cm->id, 'id' => $course->id]
    ) : '',
    "restoreurl" => has_capability('moodle/restore:restoreactivity', $modulecontext) ? new moodle_url(
        '/backup/restorefile.php',
        ['contextid' => $modulecontext->id]
    ) : '',
    "bs" => $CFG->branch >= 500 ? '-bs' : '',
    "hascourseindex" => $hascourseindex,
];

echo $OUTPUT->render_from_template('mod_flexbook/pagenav', $datafortemplate);

$datafortemplate = [
    "contenttype" => $contentoptions,
    "title" => format_string($moduleinstance->name),
    "grade" => $moduleinstance->grade,
    "bs" => $CFG->branch >= 500 ? '-bs' : '',
    "hascourseindex" => $hascourseindex,
    "courseindex" => $courseindex,
];

echo $OUTPUT->render_from_template('mod_flexbook/editor/editor', $datafortemplate);

$appearance = $moduleinstance->displayoptions['beforecompletion'];
$behavior = $moduleinstance->displayoptions['beforecompletionbehavior'];

foreach ($appearance as $key => $value) {
    $moduleinstance->displayoptions[$key] = $value;
}
foreach ($behavior as $key => $value) {
    $moduleinstance->displayoptions[$key] = $value;
}

unset(
    $moduleinstance->displayoptions['beforecompletion'],
    $moduleinstance->displayoptions['beforecompletionbehavior'],
    $moduleinstance->displayoptions['aftercompletion'],
    $moduleinstance->displayoptions['aftercompletionbehavior']
);


$PAGE->requires->js_call_amd(
    'mod_flexbook/interactions',
    'init',
    [
        $cm->id, // Cmid.
        $cm->instance, // Instance.
        $course->id, // Courseid.
        $coursecontext->id, // Coursecontextid.
        $USER->id, // Userid.
        $moduleinstance->extendedcompletion, // Extended completion settings.
    ]
);

// Get items.
$items = mod_flexbook\util::get_items($cm->id, $modulecontext->id);

echo '<textarea id="doptions" style="display: none;">' . json_encode($moduleinstance->displayoptions) . '</textarea>';
echo '<textarea id="contenttypes" style="display: none;">' . json_encode($contentoptions) . '</textarea>';
echo '<textarea id="items" style="display: none;">' . json_encode($items) . '</textarea>';
echo '<textarea id="sequence" style="display: none;">' . $moduleinstance->sequence . '</textarea>';
echo $OUTPUT->footer();
