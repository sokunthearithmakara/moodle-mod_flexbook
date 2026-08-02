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
 * Callback implementations for Flexbook
 *
 * Documentation: {@link https://moodledev.io/docs/apis/plugintypes/mod}
 *
 * @package    mod_flexbook
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define('FLEXBOOK_DISPLAY_INLINE', 1);
define('FLEXBOOK_EVENT_TYPE_DUE', 'due');
define('FLEXBOOK_POSTER_MAX_BYTES', 1024 * 1024);

/**
 * File manager options for the poster image field.
 *
 * @return array
 */
function flexbook_posterimage_file_options(): array {
    return [
        'subdirs' => 0,
        'maxfiles' => 1,
        'maxbytes' => FLEXBOOK_POSTER_MAX_BYTES,
        'accepted_types' => ['web_image'],
    ];
}

/**
 * Return if the plugin supports $feature.
 *
 * @param string $feature Constant representing the feature.
 * @return bool|string|null True if the feature is supported, null otherwise.
 */
function flexbook_supports($feature) {
    global $CFG;
    $features = [
        FEATURE_MOD_INTRO,
        FEATURE_BACKUP_MOODLE2,
        FEATURE_SHOW_DESCRIPTION,
        FEATURE_COMPLETION_TRACKS_VIEWS,
        FEATURE_COMPLETION_HAS_RULES,
        FEATURE_GRADE_HAS_GRADE,
        FEATURE_GROUPS,
        FEATURE_GROUPINGS,
    ];
    if (in_array($feature, $features, true)) {
        return true;
    }
    if ($feature === FEATURE_MODEDIT_DEFAULT_COMPLETION) {
        return false;
    }
    if ($feature === FEATURE_MOD_PURPOSE) {
        return MOD_PURPOSE_CONTENT;
    }
    if ($CFG->branch >= 501 && $feature === FEATURE_MOD_OTHERPURPOSE) {
        return MOD_PURPOSE_ASSESSMENT;
    }
    return null;
}

/**
 * Returns subplugins with class name.
 * @param string $classname The class name.
 * @return array The subplugins.
 */
function flexbook_get_subplugins($classname) {
    $allsubplugins = explode(',', get_config('mod_flexbook', 'enablecontenttypes'));
    $subpluginclass = [];
    foreach ($allsubplugins as $subplugin) {
        $class = $subplugin . '\\' . $classname;
        if (class_exists($class)) {
            $subpluginclass[] = $class;
        }
    }
    return $subpluginclass;
}

/**
 * Format display options array.
 *
 * @param \stdClass $moduleinstance Instance of flexbook.
 * @return array Array of display options.
 */
function flexbook_display_options($moduleinstance) {
    $options = [];
    $options['theme'] = $moduleinstance->theme ?? get_config('mod_flexbook', 'defaulttheme') ?? '';

    $defaultappearanceraw = get_config('mod_flexbook', 'defaultappearance');
    $defaultappearance = !empty($defaultappearanceraw) ? explode(',', $defaultappearanceraw) : [
        'distractionfreemode',
        'darkmode',
        'showdescriptiononheader',
        'courseindex',
    ];

    $defaultbehaviorraw = get_config('mod_flexbook', 'defaultbehavior');
    $defaultbehavior = !empty($defaultbehaviorraw) ? explode(',', $defaultbehaviorraw) : [];

    $fields = [
        'distractionfreemode' => in_array('distractionfreemode', $defaultappearance) ? 1 : 0,
        'darkmode' => in_array('darkmode', $defaultappearance) ? 1 : 0,
        'showdescriptiononheader' => in_array('showdescriptiononheader', $defaultappearance) ? 1 : 0,
        'courseindex' => in_array('courseindex', $defaultappearance) ? 1 : 0,
        'aspectratio' => get_config('mod_flexbook', 'defaultaspectratio') ?? '',
        'kidtheme' => in_array('kidtheme', $defaultappearance) ? 1 : 0,
        'openchapterpanel' => in_array('openchapterpanel', $defaultappearance) ? 1 : 0,
        'character' => 'none',
        'limitedwidth' => (empty($defaultappearanceraw) || in_array('limitedwidth', $defaultappearance)) ? 1 : 0,
    ];

    foreach ($fields as $field => $default) {
        $options[$field] = $moduleinstance->$field ?? $default;
    }

    $options['beforecompletion'] = $moduleinstance->beforecompletion ?? flexbook_default_appearance();
    $options['aftercompletion'] = $moduleinstance->aftercompletion ?? flexbook_default_appearance();

    $defaultbehaviorgroup = flexbook_default_behavior();
    $options['beforecompletionbehavior'] = $moduleinstance->beforecompletionbehavior ?? $defaultbehaviorgroup;
    $options['aftercompletionbehavior'] = $moduleinstance->aftercompletionbehavior ?? $defaultbehaviorgroup;

    return $options;
}

/**
 * Saves a new instance of the mod_flexbook into the database.
 *
 * Given an object containing all the necessary data, (defined by the form
 * in mod_form.php) this function will create a new instance and return the id
 * number of the instance.
 *
 * @param \stdClass $moduleinstance An object from the form.
 * @param \mod_flexbook_mod_form $mform The form.
 * @return int The id of the newly inserted record.
 */
function flexbook_add_instance($moduleinstance, $mform = null) {
    global $DB;
    $cmid = $moduleinstance->coursemodule;

    $moduleinstance->timecreated = time();
    $moduleinstance->timemodified = time();

    if (empty($moduleinstance->displayasstartscreen)) {
        $moduleinstance->displayasstartscreen = 0;
    }

    $moduleinstance->text = $moduleinstance->endscreentext;
    $moduleinstance->endscreentext = '';

    $moduleinstance->displayoptions = json_encode(flexbook_display_options($moduleinstance));

    // Save to the table first.
    $moduleinstance->id = $DB->insert_record('flexbook', $moduleinstance);

    $context = context_module::instance($cmid);

    // Handle the endscreen text.
    $requiredupdate = false;
    if (!empty($moduleinstance->text['itemid'])) {
        $draftitemid = $moduleinstance->text['itemid'];
        $moduleinstance->endscreentext = file_save_draft_area_files(
            $draftitemid,
            $context->id,
            'mod_flexbook',
            'endscreentext',
            0,
            ['subdirs' => 0],
            $moduleinstance->text['text']
        );
        $requiredupdate = true;
    }

    // Handle poster image.
    if (!empty($moduleinstance->posterimage)) {
        file_save_draft_area_files(
            $moduleinstance->posterimage,
            $context->id,
            'mod_flexbook',
            'posterimage',
            0,
            flexbook_posterimage_file_options()
        );
    }

    if ($requiredupdate) {
        $DB->update_record('flexbook', $moduleinstance);
    }

    // Update the completion expected date.
    if (!empty($moduleinstance->completionexpected)) {
        \core_completion\api::update_completion_date_event(
            $moduleinstance->coursemodule,
            'flexbook',
            $moduleinstance->id,
            $moduleinstance->completionexpected
        );
    }

    flexbook_grade_item_update($moduleinstance);

    // Handle external plugins.
    $subplugins = flexbook_get_subplugins('fbmform');
    foreach ($subplugins as $subplugin) {
        if (method_exists($subplugin, 'add_instance')) {
            $subplugin::add_instance($moduleinstance, $mform, $context);
        }
    }

    return $moduleinstance->id;
}

/**
 * Updates an instance of the mod_flexbook in the database.
 *
 * Given an object containing all the necessary data (defined in mod_form.php),
 * this function will update an existing instance with new data.
 *
 * @param \stdClass $moduleinstance An object from the form in mod_form.php.
 * @param \mod_flexbook_mod_form $mform The form.
 * @return bool True if successful, false otherwise.
 */
function flexbook_update_instance($moduleinstance, $mform = null) {
    global $DB;

    $moduleinstance->id = $moduleinstance->instance;
    $moduleinstance->timemodified = time();
    $cmid = $moduleinstance->coursemodule;
    $draftitemid = $moduleinstance->endscreentext['itemid'];
    $text = $moduleinstance->endscreentext['text'];

    $moduleinstance->timemodified = time();

    // Put the endscreentext stdClass into a single field.
    $moduleinstance->endscreentext = $text;

    $completiontimeexpected = !empty($moduleinstance->completionexpected) ? $moduleinstance->completionexpected : null;
    \core_completion\api::update_completion_date_event(
        $moduleinstance->coursemodule,
        'flexbook',
        $moduleinstance->id,
        $completiontimeexpected
    );

    $context = context_module::instance($cmid);
    if ($draftitemid) {
        $moduleinstance->endscreentext = file_save_draft_area_files(
            $draftitemid,
            $context->id,
            'mod_flexbook',
            'endscreentext',
            0,
            ['subdirs' => 0],
            $text
        );
    }

    // Handle poster image.
    if (!empty($moduleinstance->posterimage)) {
        file_save_draft_area_files(
            $moduleinstance->posterimage,
            $context->id,
            'mod_flexbook',
            'posterimage',
            0,
            flexbook_posterimage_file_options()
        );
    }

    $moduleinstance->displayoptions = json_encode(flexbook_display_options($moduleinstance));

    // Finally update the record.
    $DB->update_record('flexbook', $moduleinstance);

    flexbook_grade_item_update($moduleinstance);
    flexbook_update_grades($moduleinstance);

    // Handle external plugins.
    $subplugins = flexbook_get_subplugins('fbmform');
    foreach ($subplugins as $subplugin) {
        if (method_exists($subplugin, 'update_instance')) {
            $subplugin::update_instance($moduleinstance, $mform, $context);
        }
    }

    return true;
}

/**
 * Removes an instance of the mod_flexbook from the database.
 *
 * @param int $id Id of the module instance.
 * @return bool True if successful, false on failure.
 */
function flexbook_delete_instance($id) {
    global $DB;

    $exists = $DB->get_record('flexbook', ['id' => $id]);
    if (!$exists) {
        return false;
    }

    $cm = get_coursemodule_from_instance('flexbook', $id);

    // Handle external plugins.
    $subplugins = flexbook_get_subplugins('fbmform');
    foreach ($subplugins as $subplugin) {
        if (method_exists($subplugin, 'delete_instance')) {
            $subplugin::delete_instance($exists, $cm);
        }
    }

    \core_completion\api::update_completion_date_event($cm->id, 'flexbook', $exists->id, null);

    flexbook_grade_item_delete($exists);

    $DB->delete_records('flexbook', ['id' => $id]);

    // Delete all the items.
    $DB->delete_records('flexbook_items', ['annotationid' => $id]);
    $cache = cache::make('mod_flexbook', 'fb_items');
    $cache->delete($id);

    // Delete all the completion records.
    $DB->delete_records('flexbook_completion', ['cmid' => $id]);

    // Delete all the logs.
    $DB->delete_records('flexbook_log', ['cmid' => $id]);

    return true;
}

/**
 * Returns the lists of all browsable file areas within the given module context.
 *
 * The file area 'intro' for the activity introduction field is added automatically
 * by {@see file_browser::get_file_info_context_module()}.
 *
 * @param \stdClass $course The course object.
 * @param \stdClass $cm The course module object.
 * @param \stdClass $context The context object.
 * @return array The list of file areas.
 */
function flexbook_get_file_areas($course, $cm, $context) {
    return [
        'public',
        'content',
        'endscreentext',
        'attachments',
        'text1',
        'text2',
        'text3',
        'posterimage',
    ];
}

/**
 * File browsing support for mod_flexbook file areas.
 *
 * @param \file_browser $browser The file browser.
 * @param array $areas The file areas.
 * @param \stdClass $course The course object.
 * @param \stdClass $cm The course module object.
 * @param \stdClass $context The context object.
 * @param string $filearea The name of the file area.
 * @param int $itemid The item ID.
 * @param string $filepath The file path.
 * @param string $filename The file name.
 * @return \file_info|null Instance or null if not found.
 */
function flexbook_get_file_info($browser, $areas, $course, $cm, $context, $filearea, $itemid, $filepath, $filename) {
    return null;
}

/**
 * Serves the files from the mod_flexbook file areas.
 *
 * @param \stdClass $course The course object.
 * @param \stdClass $cm The course module object.
 * @param \context $context The mod_flexbook's context.
 * @param string $filearea The name of the file area.
 * @param array $args Extra arguments (itemid, path).
 * @param bool $forcedownload Whether or not force download.
 * @param array $options Additional options affecting the file serving.
 * @return void
 */
function flexbook_pluginfile($course, $cm, $context, $filearea, $args, $forcedownload, $options = []) {

    if ($filearea != 'public' && $filearea != 'posterimage') {
        require_login($course, true, $cm);
    }

    $itemid = array_shift($args);
    $filename = array_pop($args);
    if (!$args) {
        $filepath = '/';
    } else {
        $filepath = '/' . implode('/', $args) . '/';
    }
    // Retrieve the file from the Files API.
    $fs = get_file_storage();
    $file = $fs->get_file($context->id, 'mod_flexbook', $filearea, $itemid, $filepath, $filename);
    if (!$file) {
        send_file_not_found();
    }

    // Finally send the file.
    send_stored_file($file, 0, 0, $forcedownload, $options);
}

/**
 * Extends the settings navigation with the mod_flexbook settings.
 *
 * This function is called when the context for the page is a mod_flexbook module.
 * This is not called by AJAX so it is safe to rely on the $PAGE.
 *
 * @param \settings_navigation $settingsnav The settings navigation.
 * @param \navigation_node $interactivevideonode The flexbook node.
 */
function flexbook_extend_settings_navigation($settingsnav, $interactivevideonode = null) {
    $page = $settingsnav->get_page();

    // Interaction tab.
    if (has_capability('mod/flexbook:edit', $page->context)) {
        $interactivevideonode->add(
            get_string('interactions', 'mod_flexbook'),
            new \moodle_url('/mod/flexbook/interactions.php', ['id' => $page->cm->id]),
            $interactivevideonode::TYPE_SETTING,
            null,
            null,
            new pix_icon('i/edit', '')
        );
    }

    // Report tab.
    if (has_capability('mod/flexbook:viewreport', $page->context)) {
        $interactivevideonode->add(
            get_string('report', 'mod_flexbook'),
            new \moodle_url('/mod/flexbook/report.php', ['id' => $page->cm->id, 'group' => 0]),
            $interactivevideonode::TYPE_SETTING,
            null,
            null,
            new pix_icon('i/report', '')
        );
    }
}

/**
 * Add a "Manage Flexbook" link to the course navigation for users who can manage Flexbooks.
 *
 * @param \navigation_node $navigation The navigation node to extend.
 * @param \stdClass $course The course object.
 * @param \context $context The context of the course.
 */
function flexbook_extend_navigation_course(\navigation_node $navigation, \stdClass $course, \context $context) {
    if (!has_capability('mod/flexbook:manage', $context)) {
        return;
    }
    $url = new moodle_url('/mod/flexbook/manage.php', ['courseid' => $course->id]);
    $navigation->add(
        get_string('managetitle', 'mod_flexbook'),
        $url,
        navigation_node::TYPE_SETTING,
        null,
        null,
        new pix_icon('i/report', '')
    );
}

/**
 * Add a get_coursemodule_info function.
 *
 * Given a course_module object, this function returns any "extra" information that may be needed
 * when printing this activity in a course listing.  See get_array_of_activities() in course/lib.php.
 *
 * @param \stdClass $coursemodule The coursemodule object (record).
 * @return \cached_cm_info|false An object on information that the courses
 *                        will know about (most noticeably, an icon).
 */
function flexbook_get_coursemodule_info($coursemodule) {
    global $DB;
    $dbparams = ['id' => $coursemodule->instance];
    $interactive = $DB->get_record('flexbook', $dbparams, '*');
    if (!$interactive) {
        return false;
    }

    $result = new cached_cm_info();
    $result->name = $interactive->name;
    $result->customdata['displayoptions'] = $interactive->displayoptions;
    $result->customdata['intro'] = $interactive->intro;
    $result->customdata['displayasstartscreen'] = $interactive->displayasstartscreen;
    if ($coursemodule->showdescription) {
        $result->content = format_module_intro('flexbook', $interactive, $coursemodule->id, false);
    }

    if ($coursemodule->completion == COMPLETION_TRACKING_AUTOMATIC) {
        $result->customdata['customcompletionrules']['completionpercentage'] = $interactive->completionpercentage;
        // Add extended completion.
        $result->customdata['extendedcompletion'] = $interactive->extendedcompletion ?? '[]';
        foreach (json_decode($result->customdata['extendedcompletion']) as $rule => $value) {
            $result->customdata['customcompletionrules'][$rule] = $value;
        }
    }
    $result->customdata['type'] = $interactive->type;
    $context = context_module::instance($coursemodule->id);
    $endcontent = file_rewrite_pluginfile_urls(
        $interactive->endscreentext,
        'pluginfile.php',
        $context->id,
        'mod_flexbook',
        'endscreentext',
        0
    );
    $result->customdata['endscreentext'] = $endcontent;

    // Poster image.
    $fs = get_file_storage();
    $files = $fs->get_area_files($context->id, 'mod_flexbook', 'posterimage', 0, 'itemid, filepath, filename', false);
    if (count($files) > 0) {
        $file = reset($files);
        $result->customdata['posterimage'] = moodle_url::make_pluginfile_url(
            $context->id,
            'mod_flexbook',
            'posterimage',
            0,
            $file->get_filepath(),
            $file->get_filename()
        )->out(false);
    }

    return $result;
}

/**
 * Implements the cm_info_dynamic hook to set a custom activity icon.
 *
 * Called at render time (not cached) so it can use $OUTPUT. Sets the icon URL
 * based on the 'type' field stored in the Flexbook instance, allowing each
 * Flexbook to display the icon of its primary content type.
 *
 * @param \cm_info $cm The course module info object.
 * @return void
 */
function flexbook_cm_info_dynamic(cm_info $cm) {

    $type = $cm->customdata['type'] ?? null;
    if (empty($type)) {
        return;
    }

    // Find the content type plugin that owns this type name.
    $allplugins = explode(',', get_config('mod_flexbook', 'enablecontenttypes'));
    foreach ($allplugins as $pluginname) {
        $class = $pluginname . '\\main';
        if (!class_exists($class)) {
            continue;
        }
        $instance = new $class();
        if (!method_exists($instance, 'get_property')) {
            continue;
        }
        $prop = $instance->get_property();
        if (($prop['name'] ?? '') !== $type) {
            continue;
        }
        // Resolve the icon URL from the plugin's component.
        // Accessing $PAGE or $OUTPUT will cause an error, so avoid them.
        $component = $prop['component'] ?? $pluginname;
        $iconurl = new moodle_url('/theme/image.php', [
            'theme' => get_config('core', 'theme'),
            'component' => $component,
            'image' => 'cicon',
        ]);
        $cm->set_icon_url($iconurl);
        return;
    }
}

/**
 * Load admin settings AMD on Moodle versions without hook support.
 *
 * Legacy callback for Moodle versions before core hooks (4.4). Not called when hooks are available.
 */
function flexbook_before_http_headers() {
    \mod_flexbook\hook_callbacks::init_plugin_admin_settings();
}

if ($CFG->branch <= 403) {
    /**
     * Adds JavaScript before the footer is rendered.
     *
     * This function is called to add JavaScript before the footer is rendered
     * when the page is a course view.
     */
    function flexbook_before_footer() {
        global $PAGE, $CFG;
        if (strpos($PAGE->bodyclasses, 'path-course-view') === false) {
            return;
        }
        echo \mod_flexbook\util::render_moodle_version();
    }
}

/**
 * Creates or updates grade item for the given mod_flexbook instance.
 *
 * Needed by {@see grade_update_mod_grades()}.
 *
 * @param \stdClass $moduleinstance Instance object with extra cmidnumber and modname property.
 * @param mixed $grades Null to update all grades, false to delete all grades, or array of user grades.
 * @return void
 */
function flexbook_grade_item_update($moduleinstance, $grades = null) {
    global $CFG;
    require_once($CFG->libdir . '/gradelib.php');

    if (!isset($moduleinstance->courseid)) {
        $moduleinstance->courseid = $moduleinstance->course;
    }

    $item = [];
    $item['iteminfo'] = null;
    $item['itemname'] = clean_param($moduleinstance->name, PARAM_NOTAGS);
    if ($moduleinstance->grade > 0) {
        $item['gradetype'] = GRADE_TYPE_VALUE;
        $item['grademax']  = $moduleinstance->grade;
        $item['grademin']  = 0;
    } else {
        $item['gradetype'] = GRADE_TYPE_NONE;
    }

    if ($grades === 'reset') {
        $item['reset'] = true;
        $grades = null;
    }

    grade_update(
        '/mod/flexbook',
        $moduleinstance->course,
        'mod',
        'flexbook',
        $moduleinstance->id,
        0,
        $grades,
        $item
    );
}

/**
 * Delete grade item for given mod_flexbook instance.
 *
 * @param \stdClass $moduleinstance Instance object.
 * @return int 0 if successful, a error code otherwise.
 */
function flexbook_grade_item_delete($moduleinstance) {
    global $CFG;
    require_once($CFG->libdir . '/gradelib.php');
    if (!isset($moduleinstance->courseid)) {
        $moduleinstance->courseid = $moduleinstance->course;
    }

    return grade_update(
        '/mod/flexbook',
        $moduleinstance->courseid,
        'mod',
        'flexbook',
        $moduleinstance->id,
        0,
        null,
        ['deleted' => 1]
    );
}

/**
 * Update mod_flexbook grades in the gradebook.
 *
 * Needed by {@see grade_update_mod_grades()}.
 *
 * @param \stdClass $moduleinstance Instance object with extra cmidnumber and modname property.
 * @param int $userid Update grade of specific user only, 0 means all participants.
 * @return void
 */
function flexbook_update_grades($moduleinstance, $userid = 0) {
    global $CFG;
    require_once($CFG->libdir . '/gradelib.php');
    if ($moduleinstance->grade == 0) {
        $moduleinstance->{'grade[modgrade_type]'} = GRADE_TYPE_NONE;
        flexbook_grade_item_update($moduleinstance);
    } else if ($grades = flexbook_get_user_grades($moduleinstance, $userid)) {
        flexbook_grade_item_update($moduleinstance, $grades);
    } else {
        flexbook_grade_item_update($moduleinstance);
    }
}

/**
 * Get user grades for the mod_flexbook module.
 *
 * @param \stdClass $moduleinstance The module instance object.
 * @param int $userid The user ID (optional).
 * @return array The user grades.
 */
function flexbook_get_user_grades($moduleinstance, $userid = 0) {
    global $CFG, $DB;
    require_once($CFG->libdir . '/gradelib.php');
    // Get user grades from the grade_grades table with key as userid.
    $grades = [];
    if ($userid) {
        $sql = "SELECT g.userid AS userid, g.rawgrade AS rawgrade, g.usermodified AS usermodified
                FROM {grade_grades} g
                LEFT JOIN {grade_items} gi ON g.itemid = gi.id
                WHERE gi.iteminstance = :iteminstance AND gi.itemmodule = :itemmodule AND g.userid = :userid";
        $params = ['iteminstance' => $moduleinstance->id, 'itemmodule' => 'flexbook', 'userid' => $userid];
        $grades = $DB->get_records_sql($sql, $params);
    } else {
        $sql = "SELECT g.userid AS userid, g.rawgrade AS rawgrade, g.usermodified AS usermodified
                FROM {grade_grades} g
                LEFT JOIN {grade_items} gi ON g.itemid = gi.id
                WHERE gi.iteminstance = :iteminstance AND gi.itemmodule = :itemmodule";
        $params = ['iteminstance' => $moduleinstance->id, 'itemmodule' => 'flexbook'];
        $grades = $DB->get_records_sql($sql, $params);
    }
    return $grades;
}

/**
 * Reset all user grades for the mod_flexbook module.
 *
 * @param \stdClass $data The module instance object.
 * @return array The status.
 */
function flexbook_reset_userdata($data) {
    global $DB;
    $status = [];
    $resetcompletion = isset($data->reset_completion) && $data->reset_completion;
    $courseid = $data->courseid;

    if ($resetcompletion) { // Reset completion and grade since they are related.
        $DB->delete_records_select(
            'flexbook_completion',
            'cmid IN (SELECT id FROM {flexbook} WHERE course = :courseid)',
            ['courseid' => $courseid]
        );

        // Delete flexbook_log.
        $DB->delete_records_select(
            'flexbook_log',
            'cmid IN (SELECT id FROM {flexbook} WHERE course = :courseid)',
            ['courseid' => $courseid]
        );

        // Delete flexbook associated files in text1, text2, text3 and attachments areas.
        $fs = get_file_storage();
        // Get context ids for all flexbook instances in the course.
        $coursemoduleids = $DB->get_fieldset_select(
            'course_modules',
            'id',
            'module = :module AND course = :course',
            ['module' => $DB->get_field('modules', 'id', ['name' => 'flexbook']), 'course' => $courseid]
        );

        if ($coursemoduleids) {
            [$insql, $inparams] = $DB->get_in_or_equal($coursemoduleids, SQL_PARAMS_NAMED);
            $inparams['contextlevel'] = CONTEXT_MODULE;
            $contextids = $DB->get_fieldset_select(
                'context',
                'id',
                "instanceid $insql AND contextlevel = :contextlevel",
                $inparams
            );

            foreach ($contextids as $contextid) {
                $fs->delete_area_files($contextid, 'mod_flexbook', 'text1');
                $fs->delete_area_files($contextid, 'mod_flexbook', 'text2');
                $fs->delete_area_files($contextid, 'mod_flexbook', 'text3');
                $fs->delete_area_files($contextid, 'mod_flexbook', 'attachments');
            }
        }

        // Get all related modules and reset their grades.
        $flexbooks = $DB->get_records('flexbook', ['course' => $courseid]);
        foreach ($flexbooks as $flexbook) {
            flexbook_grade_item_update($flexbook, 'reset');
        }

        $status[] = [
            'component' => get_string('modulenameplural', 'flexbook'),
            'item' => get_string('resetcompletion', 'interactivevideo'),
            'error' => false,
        ];
    }

    if ($data->reset_gradebook_grades) {
        $flexbooks = $DB->get_records('flexbook', ['course' => $courseid]);
        foreach ($flexbooks as $flexbook) {
            flexbook_grade_item_update($flexbook, 'reset');
        }

        $status[] = [
            'component' => get_string('modulenameplural', 'flexbook'),
            'item' => get_string('resetgrades', 'interactivevideo'),
            'error' => false,
        ];
    }

    return $status;
}

/**
 * Get content of the interaction.
 *
 * @param array $arg The arguments.
 * @return string The content.
 */
function flexbook_output_fragment_getcontent($arg) {
    $prop = json_decode($arg['prop']);
    $class = $prop->class;
    if (!class_exists($class)) {
        return json_encode($arg);
    }
    $arg['plugin'] = 'flexbook';
    $contenttype = new $class($arg);
    return $contenttype->get_content($arg);
}

/**
 * This function receives a calendar event and returns the action associated with it, or null if there is none.
 *
 * This is used by block_myoverview in order to display the event appropriately. If null is returned then the event
 * is not displayed on the block.
 *
 * @param calendar_event $event
 * @param \core_calendar\action_factory $factory
 * @param int $userid User id to use for all capability checks, etc. Set to 0 for current user (default).
 * @return \core_calendar\local\event\entities\action_interface|null
 */
function flexbook_core_calendar_provide_event_action(
    calendar_event $event,
    \core_calendar\action_factory $factory,
    int $userid = 0
) {
    global $USER;

    if (!$userid) {
        $userid = $USER->id;
    }

    $cm = get_fast_modinfo($event->courseid, $userid)->instances['flexbook'][$event->instance];

    if (!$cm->uservisible) {
        // The module is not visible to the user for any reason.
        return null;
    }

    $completion = new \completion_info($cm->get_course());

    $completiondata = $completion->get_data($cm, false, $userid);

    if ($completiondata->completionstate != COMPLETION_INCOMPLETE) {
        return null;
    }

    return $factory->create_instance(
        get_string('view', 'flexbook'),
        new \moodle_url('/mod/flexbook/view.php', ['id' => $cm->id]),
        1,
        true
    );
}

/**
 * Render complete report row for a Flexbook user.
 *
 * @param \stdClass $course The course object.
 * @param \stdClass $user The user object.
 * @param cm_info|\stdClass $mod The course module object.
 * @param \stdClass $flexbook The Flexbook instance object.
 * @return void
 */
function flexbook_user_complete($course, $user, $mod, $flexbook) {
    global $DB;

    $completion = $DB->get_record_sql(
        'SELECT fc.*, fi.title AS lastviewedtitle
           FROM {flexbook_completion} fc
      LEFT JOIN {flexbook_items} fi
             ON fi.id = fc.lastviewed
            AND fi.cmid = fc.cmid
          WHERE fc.cmid = :cmid
            AND fc.userid = :userid',
        ['cmid' => $mod->id, 'userid' => $user->id]
    );
    if (!$completion) {
        echo '<p>' . get_string('notstarted', 'mod_flexbook') . '</p>';
        return;
    }

    $details = json_decode($completion->details ?? '{}', true);
    $totaltimespent = 0;
    $totalviews = 0;
    if (is_array($details)) {
        foreach ($details as $itemdetails) {
            if (!is_array($itemdetails)) {
                continue;
            }
            $totaltimespent += !empty($itemdetails['t']) ? (int) $itemdetails['t'] : 0;
            $totalviews += !empty($itemdetails['v']) ? (int) $itemdetails['v'] : 0;
        }
    }

    $lastviewed = '-';
    if (!empty($completion->lastviewedtitle)) {
        $lastviewed = format_string($completion->lastviewedtitle);
    } else if (!empty($completion->timeended)) {
        $lastviewed = get_string('endscreen', 'mod_flexbook');
    }

    $formattedduration = function (int $milliseconds): string {
        if ($milliseconds <= 0) {
            return '-';
        }
        $seconds = (int) floor($milliseconds / 1000);
        $hours = intdiv($seconds, HOURSECS);
        $minutes = intdiv($seconds % HOURSECS, MINSECS);
        $seconds = $seconds % MINSECS;

        if ($hours > 0) {
            return sprintf('%d:%02d:%02d', $hours, $minutes, $seconds);
        }
        return sprintf('%d:%02d', $minutes, $seconds);
    };

    $formatdate = function ($timestamp): string {
        return !empty($timestamp) ? userdate($timestamp, get_string('strftimedatetime', 'langconfig')) : '-';
    };

    echo '<table class="table table-sm table-striped small w-100">';
    echo '<thead>';
    echo '<tr>';
    echo '<th>' . get_string('timestarted', 'mod_flexbook') . '</th>';
    echo '<th>' . get_string('completionpercentage', 'mod_flexbook')
        . ($flexbook->completionpercentage ? ' (' . (int) $flexbook->completionpercentage . '%)' : '') . '</th>';
    echo '<th>' . get_string('xp', 'mod_flexbook') . '</th>';
    echo '<th>' . get_string('timecompleted', 'mod_flexbook') . '</th>';
    echo '<th>' . get_string('reachedend', 'mod_flexbook') . '</th>';
    echo '<th>' . get_string('lastviewed', 'mod_flexbook') . '</th>';
    echo '<th>' . get_string('totaltimespent', 'mod_flexbook') . '</th>';
    echo '<th>' . get_string('views', 'mod_flexbook') . '</th>';
    echo '</tr>';
    echo '</thead>';
    echo '<tbody>';
    echo '<tr>';
    echo '<td>' . $formatdate($completion->timecreated) . '</td>';
    echo '<td>' . (int) $completion->completionpercentage . '%</td>';
    echo '<td>' . format_float((float) $completion->xp, 2, true, true) . '</td>';
    echo '<td>' . $formatdate($completion->timecompleted) . '</td>';
    echo '<td>' . (!empty($completion->timeended) ? get_string('yes') : get_string('no')) . '</td>';
    echo '<td>' . s($lastviewed) . '</td>';
    echo '<td>' . $formattedduration($totaltimespent) . '</td>';
    echo '<td>' . (int) $totalviews . '</td>';
    echo '</tr>';
    echo '</tbody>';
    echo '</table>';
}

/**
 * This function is called when a module instance is updated.
 *
 * @param \stdClass $moduleinstance The module instance object.
 * @return bool
 */
function flexbook_update_event($moduleinstance) {
    global $DB, $CFG;
    require_once($CFG->libdir . '/calendar/lib.php');

    // Start with creating the event.
    $event = new stdClass();
    $event->modulename  = 'flexbook';
    $event->courseid = $moduleinstance->course;
    $event->groupid = 0;
    $event->userid  = 0;
    $event->instance  = $moduleinstance->id;
    $event->type = CALENDAR_EVENT_TYPE_ACTION;

    // Convert the links to pluginfile. It is a bit hacky but at this stage the files
    // might not have been saved in the module area yet.
    $intro = $moduleinstance->intro;
    if ($draftid = file_get_submitted_draft_itemid('introeditor')) {
        $intro = file_rewrite_urls_to_pluginfile($intro, $draftid);
    }

    // We need to remove the links to files as the calendar is not ready
    // to support module events with file areas.
    $intro = strip_pluginfile_content($intro);
    if ($moduleinstance->showdescription == 1) {
        $event->description = [
            'text' => $intro,
            'format' => $moduleinstance->introformat,
        ];
    } else {
        $event->description = [
            'text' => '',
            'format' => $moduleinstance->introformat,
        ];
    }

    $eventtype = FLEXBOOK_EVENT_TYPE_DUE;
    if ($moduleinstance->completionexpected) {
        $event->name = get_string('calendardue', 'assign', $moduleinstance->name);
        $event->eventtype = $eventtype;
        $event->timestart = $moduleinstance->completionexpected;
        $event->timesort = $moduleinstance->completionexpected;
        $select = "modulename = :modulename
                       AND instance = :instance
                       AND eventtype = :eventtype
                       AND groupid = 0
                       AND courseid <> 0";
        $params = ['modulename' => 'flexbook', 'instance' => $moduleinstance->id, 'eventtype' => $eventtype];
        $event->id = $DB->get_field_select('event', 'id', $select, $params);

        // Now process the event.
        if ($event->id) {
            $calendarevent = calendar_event::load($event->id);
            $calendarevent->update($event, false);
        } else {
            calendar_event::create($event, false);
        }
    } else {
        $DB->delete_records('event', [
            'modulename' => 'flexbook',
            'instance' => $moduleinstance->id,
            'eventtype' => $eventtype,
        ]);
    }

    return true;
}

/**
 * Form elements for appearance and behavior settings.
 *
 * @param \MoodleQuickForm $mform The form.
 * @param \stdClass $current The current data.
 * @param array $sections The sections to include.
 * @return void
 */
function flexbook_appearanceandbehavior_form($mform, $current, $sections = ['appearance', 'behavior']) {
    global $CFG;
    if (in_array('appearance', $sections)) {
        $mform->addElement(
            'html',
            '<div class="iv-form-group row fitem"><div class="col-md-12 col-form-label d-flex pb-0  iv-pr-md-0">
        <h5 class="w-100 border-bottom">' . get_string('appearancesettings', 'mod_flexbook')
                . '</h5></div></div>',
        );

        // Set theme.
        if (get_config('mod_flexbook', 'allowcustomtheme')) {
            $themeobjects = get_list_of_themes();
            $themes = [];
            $themes[''] = get_string('forceno');
            foreach ($themeobjects as $key => $theme) {
                if (empty($theme->hidefromselector)) {
                    $themes[$key] = get_string('pluginname', 'theme_' . $theme->name);
                }
            }
            $mform->addElement('select', 'theme', get_string('forcetheme'), $themes);
        } else {
            $mform->addElement('hidden', 'theme', '');
        }
        $mform->setType('theme', PARAM_TEXT);

        $mform->addElement(
            'filemanager',
            'posterimage',
            get_string('posterimage', 'mod_flexbook'),
            null,
            flexbook_posterimage_file_options()
        );

        $aspectratios = [
            '' => get_string('unset', 'mod_flexbook'),
            '16:9' => '16:9',
            '21:9' => '21:9',
            '9:16' => '9:16',
            '3:4' => '3:4',
            '4:3' => '4:3',
            '1:1' => '1:1',
        ];
        $mform->addElement('select', 'aspectratio', get_string('aspectratio', 'mod_flexbook'), $aspectratios);

        // Use distraction-free mode.
        $group = [];
        $group[] = $mform->createElement(
            'advcheckbox',
            'distractionfreemode',
            '',
            get_string('distractionfreemode', 'mod_flexbook'),
            ['group' => 1],
            [0, 1]
        );

        // Dark mode.
        $group[] = $mform->createElement(
            'advcheckbox',
            'darkmode',
            '',
            get_string('darkmode', 'mod_flexbook'),
            ['group' => 1],
            [0, 1]
        );
        $mform->hideIf('darkmode', 'distractionfreemode', 'eq', 0);

        // Kid theme.
        $group[] = $mform->createElement(
            'advcheckbox',
            'kidtheme',
            '',
            get_string('kidtheme', 'mod_flexbook'),
            ['group' => 1],
            [0, 1]
        );

        $group[] = $mform->createElement(
            'advcheckbox',
            'courseindex',
            '',
            get_string('courseindex', 'mod_flexbook'),
            ['group' => 1],
            [0, 1]
        );
        $mform->hideIf('courseindex', 'distractionfreemode', 'eq', 0);

        $group[] = $mform->createElement(
            'advcheckbox',
            'openchapterpanel',
            '',
            get_string('openchapterpanel', 'mod_flexbook'),
            ['group' => 1],
            [0, 1]
        );

        $group[] = $mform->createElement(
            'advcheckbox',
            'limitedwidth',
            '',
            get_string('limitedwidth', 'mod_flexbook'),
            ['group' => 1],
            [0, 1]
        );

        $mform->addGroup($group, 'appearancegroup', '', '', false);
        $mform->setDefault('limitedwidth', 1);
        $mform->hideIf('limitedwidth', 'aspectratio', 'neq', '');

        $characters = [
            'none' => get_string('none'),
            'duo' => get_string('duo', 'mod_flexbook'),
            'walle' => get_string('walle', 'mod_flexbook'),
            'panda' => get_string('panda', 'mod_flexbook'),
            'parrot' => get_string('parrot', 'mod_flexbook'),
            'monkey' => get_string('monkey', 'mod_flexbook'),
            'random' => get_string('random', 'mod_flexbook'),
        ];
        $mform->addElement('select', 'character', get_string('character', 'mod_flexbook'), $characters);
        $mform->setType('character', PARAM_ALPHA);
        $mform->setDefault('character', 'none');
        $mform->hideIf('character', 'kidtheme', 'notchecked');

        // 1.4.5 options.
        // Controls before completion.
        $controls = [
            ['controlbar', 'mod_flexbook'],
            ['chaptertoggle', 'mod_flexbook'],
            ['share', 'mod_flexbook'],
            ['fullscreen', 'mod_flexbook'],
            ['xpcounter', 'mod_flexbook'],
            ['interactioncounter', 'mod_flexbook'],
            ['interactionnavigation', 'mod_flexbook'],
        ];

        $mform->addElement(
            'static',
            'beforecompletionheader',
            '',
            '<b class="w-100 d-block">' . get_string('controlsbeforecompletion', 'mod_flexbook') . '</b>'
        );
        $group = [];
        foreach ($controls as $control) {
            $group[] = $mform->createElement(
                'advcheckbox',
                $control[0],
                '',
                get_string($control[0], $control[1]),
                ['group' => 1],
                [0, 1]
            );
        }

        $mform->addGroup(
            $group,
            'beforecompletion',
            '',
            '',
            true
        );

        // Controls after completion.
        $mform->addElement(
            'static',
            'aftercompletionheader',
            '',
            '<b class="w-100 d-block">' . get_string('controlsaftercompletion', 'mod_flexbook') . '</b>'
        );
        $group = [];
        foreach ($controls as $control) {
            $group[] = $mform->createElement(
                'advcheckbox',
                $control[0],
                '',
                get_string($control[0], $control[1]),
                ['group' => 1],
                [0, 1]
            );
        }

        $mform->addGroup(
            $group,
            'aftercompletion',
            '',
            '',
            true
        );

        $defaultappearance = flexbook_default_appearance();
        $mform->setDefaults([
            'beforecompletion' => $defaultappearance,
            'aftercompletion' => $defaultappearance,
        ]);
    }

    if (in_array('behavior', $sections)) {
        $mform->addElement(
            'html',
            '<div class="iv-form-group row fitem"><div class="col-md-12 col-form-label d-flex pb-0  iv-pr-md-0">
        <h5 class="w-100 border-bottom">' . get_string('behaviorsettings', 'mod_flexbook')
                . '</h5></div></div>',
        );

        $behaviors = [
            'preventskipping',
            'allowdeleteprogress',
        ];

        // Behavior before completion.
        $mform->addElement(
            'static',
            'beforecompletionbehaviorheader',
            '',
            '<b class="w-100 d-block">' . get_string('behaviorbeforecompletion', 'mod_interactivevideo') . '</b>'
        );
        $group = [];
        foreach ($behaviors as $behavior) {
            $group[] = $mform->createElement(
                'advcheckbox',
                $behavior,
                '',
                get_string($behavior == 'preventskipping' ? 'preventskip' : $behavior, $behavior == 'preventskipping'
                    ? 'mod_flexbook' : 'mod_interactivevideo'),
                ['group' => 1],
                [0, 1]
            );
        }
        $mform->addGroup(
            $group,
            'beforecompletionbehavior',
            '',
            '',
            true
        );

        // Behavior after completion.
        $mform->addElement(
            'static',
            'aftercompletionbehaviorheader',
            '',
            '<b class="w-100 d-block">' . get_string('behavioraftercompletion', 'mod_interactivevideo') . '</b>'
        );
        $group = [];
        foreach ($behaviors as $behavior) {
            $group[] = $mform->createElement(
                'advcheckbox',
                $behavior,
                '',
                get_string($behavior == 'preventskipping' ? 'preventskip' : $behavior, $behavior == 'preventskipping'
                    ? 'mod_flexbook' : 'mod_interactivevideo'),
                ['group' => 1],
                [0, 1]
            );
        }
        $mform->addGroup(
            $group,
            'aftercompletionbehavior',
            '',
            '',
            true
        );

        $defaultbehavior = flexbook_default_behavior();
        $mform->setDefaults([
            'beforecompletionbehavior' => $defaultbehavior,
            'aftercompletionbehavior' => $defaultbehavior,
        ]);
    }
}

/**
 * Default appearance settings
 *
 * @return array
 */
function flexbook_default_appearance() {
    $defaultappearance = get_config('mod_flexbook', 'defaultappearance');
    $defaultappearance = !empty($defaultappearance) ? explode(',', $defaultappearance) : [
        'controlbar',
        'chaptertoggle',
        'share',
        'fullscreen',
        'xpcounter',
        'interactioncounter',
        'interactionnavigation',
        'kidtheme',
    ];

    return [
        'controlbar' => in_array('controlbar', $defaultappearance) ? 1 : 0,
        'chaptertoggle' => in_array('chaptertoggle', $defaultappearance) ? 1 : 0,
        'share' => in_array('share', $defaultappearance) ? 1 : 0,
        'fullscreen' => in_array('fullscreen', $defaultappearance) ? 1 : 0,
        'aspectratio' => get_config('mod_flexbook', 'defaultaspectratio') ?? '',
        'kidtheme' => in_array('kidtheme', $defaultappearance) ? 1 : 0,
        'xpcounter' => in_array('xpcounter', $defaultappearance) ? 1 : 0,
        'interactioncounter' => in_array('interactioncounter', $defaultappearance) ? 1 : 0,
        'interactionnavigation' => in_array('interactionnavigation', $defaultappearance) ? 1 : 0,
    ];
}

/**
 * Default behavior settings
 *
 * @return array
 */
function flexbook_default_behavior() {
    $defaultbehavior = get_config('mod_flexbook', 'defaultbehavior');
    $defaultbehavior = !empty($defaultbehavior) ? explode(',', $defaultbehavior) : [];

    return [
        'preventskipping' => in_array('preventskipping', $defaultbehavior) ? 1 : 0,
        'allowdeleteprogress' => in_array('allowdeleteprogress', $defaultbehavior) ? 1 : 0,
    ];
}

/**
 * Options for the primary content type selector (activity icon).
 *
 * @return array Option value => label.
 */
function flexbook_get_primary_content_type_options() {
    $allplugins = explode(',', get_config('mod_flexbook', 'enablecontenttypes'));
    $typeoptions = [];
    foreach ($allplugins as $pluginname) {
        $class = $pluginname . '\\main';
        if (!class_exists($class)) {
            continue;
        }
        $instance = new $class();
        if (!method_exists($instance, 'get_property')) {
            continue;
        }
        $prop = $instance->get_property();
        if (empty($prop['flexbook'])) {
            continue;
        }
        $typeoptions[$prop['name']] = $prop['title'];
    }

    if (count($typeoptions) >= 1) {
        return ['' => get_string('defaultflexbookicon', 'mod_flexbook')] + $typeoptions;
    }

    return ['' => get_string('defaultflexbookicon', 'mod_flexbook')];
}

/**
 * Build form default values from site-level Flexbook admin settings.
 *
 * Used by the course settings form and activity mod_form when no course overrides exist.
 *
 * @param int $courseid The course ID (optional).
 * @param int $contextid The course context ID (optional).
 * @return array Form field values keyed by element name.
 */
function flexbook_get_site_default_form_values($courseid = 0, $contextid = 0) {
    global $CFG;
    $values = flexbook_display_options(new \stdClass());
    $values['courseid'] = $courseid;
    $values['contextid'] = $contextid;
    $values['id'] = 0;
    $values['displayasstartscreen'] = 0;
    $values['completionpercentage'] = 0;
    $values['reachend'] = 0;
    $values['type'] = '';
    $values['grade'] = $CFG->gradepointdefault ?? 100;
    $values['gradepass'] = '';
    $values['gradecat'] = 0;
    $values['completionview'] = 0;
    $values['completionusegrade'] = 0;
    $values['endscreentext'] = [
        'text' => '',
        'format' => FORMAT_HTML,
        'itemid' => file_get_submitted_draft_itemid('endscreentext'),
    ];
    return $values;
}

/**
 * Apply grade and completion defaults to a Flexbook activity mod_form data array.
 *
 * @param array $defaultvalues Form default values (modified in place).
 * @param array $options Grade/completion options (typically from displayoptions JSON).
 * @return void
 */
function flexbook_apply_grade_completion_form_defaults(array &$defaultvalues, array $options) {
    global $CFG;
    require_once($CFG->libdir . '/gradelib.php');

    $gradefieldname = \core_grades\component_gradeitems::get_field_name_for_itemnumber('mod_flexbook', 0, 'grade');
    $gradecatfieldname = \core_grades\component_gradeitems::get_field_name_for_itemnumber('mod_flexbook', 0, 'gradecat');
    $gradepassfieldname = \core_grades\component_gradeitems::get_field_name_for_itemnumber('mod_flexbook', 0, 'gradepass');

    if (array_key_exists('grade', $options) && $options['grade'] !== '' && $options['grade'] !== null) {
        $grade = $options['grade'];
        if (is_array($grade)) {
            // Modgrade expects a scalar default on the group element, not a subelement array.
            if (isset($grade['modgrade_point']) && $grade['modgrade_point'] !== '') {
                $defaultvalues[$gradefieldname] = $grade['modgrade_point'];
            }
        } else {
            $defaultvalues[$gradefieldname] = $grade;
        }
    }
    if (array_key_exists('gradepass', $options) && $options['gradepass'] !== '' && $options['gradepass'] !== null) {
        $defaultvalues[$gradepassfieldname] = $options['gradepass'];
    }
    if (array_key_exists('gradecat', $options)) {
        $defaultvalues[$gradecatfieldname] = $options['gradecat'];
    }
    if (!empty($options['completionview'])) {
        $defaultvalues['completionview'] = 1;
        $defaultvalues['completion'] = COMPLETION_TRACKING_AUTOMATIC;
    }
    if (!empty($options['completionusegrade'])) {
        $defaultvalues['completionusegrade'] = 1;
        $defaultvalues['completion'] = COMPLETION_TRACKING_AUTOMATIC;
    }
}

/**
 * Format text fragment.
 *
 * @param array $args
 * @return string
 */
function flexbook_output_fragment_format_text($args) {
    $text = $args['text'] ?? '';
    $contextid = $args['contextid'] ?? context_system::instance()->id;
    $format = $args['format'] ?? FORMAT_HTML;

    $context = context::instance_by_id($contextid);

    $text = format_text($text, $format, ['context' => $context]);

    return str_replace('brokenfile.php#', 'draftfile.php', $text);
}

/**
 * Build embed-only display options from URL parameters (not parent activity settings).
 *
 * @param int|null $dmode Dark mode URL param (dm). 1 enables, otherwise off.
 * @param int|null $kid Kid theme URL param (kid). 1 enables, otherwise off.
 * @return array Embed display options for AMD (#doptions).
 */
function flexbook_build_embed_options(?int $dmode, ?int $kid): array {
    return [
        'darkmode' => ($dmode === 1) ? 1 : 0,
        'kidtheme' => ($kid === 1) ? 1 : 0,
        'distractionfreemode' => 1,
    ];
}

/**
 * Apply embed display options to the page (body classes and forced theme).
 *
 * @param array $embedoptions From flexbook_build_embed_options().
 * @param string|null $forcetheme Optional Moodle theme name from URL.
 * @return void
 */
function flexbook_apply_embed_page_display(array $embedoptions, ?string $forcetheme = null): void {
    global $PAGE;

    if (!empty($embedoptions['kidtheme'])) {
        $PAGE->add_body_class('kidtheme');
    }
    if ($forcetheme) {
        $PAGE->force_theme($forcetheme);
    }
}

/**
 * Validate access to a standalone embedded interaction.
 *
 * Phase 1: require login and mod/flexbook:view on the parent activity.
 * Phase 2: optional $token for off-course / external iframe access (not implemented yet).
 *
 * @param int $itemid flexbook_items.id (interaction id, not cmid).
 * @param string|null $token Optional mobile/external token (phase 2).
 * @return array{item: stdClass, cm: cm_info, course: stdClass, moduleinstance: stdClass, context: context_module}
 * @throws moodle_exception
 */
function flexbook_validate_embed_access(int $itemid, ?string $token = null): array {
    global $DB;

    $item = $DB->get_record('flexbook_items', ['id' => $itemid]);
    if (!$item) {
        throw new moodle_exception('invalidinteraction', 'mod_flexbook');
    }

    $cm = get_coursemodule_from_id('flexbook', $item->cmid, 0, false, MUST_EXIST);
    $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
    $moduleinstance = $DB->get_record('flexbook', ['id' => $cm->instance], '*', MUST_EXIST);
    $context = context_module::instance($cm->id);

    // Phase 2: token-based login when not logged in.
    if ($token !== null && !isloggedin()) {
        // Reserved for external embed access via flexbook_validate_embed_token().
        throw new moodle_exception('invalidtoken', 'mod_flexbook');
    }

    require_login($course, true, $cm);

    $modinfo = get_fast_modinfo($course);
    $cm = $modinfo->get_cm($cm->id);

    if (!has_capability('mod/flexbook:view', $context)) {
        throw new moodle_exception('nopermissiontoview', 'mod_flexbook');
    }

    return [
        'item' => $item,
        'cm' => $cm,
        'course' => $course,
        'moduleinstance' => $moduleinstance,
        'context' => $context,
    ];
}
