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

namespace mod_flexbook;

defined('MOODLE_INTERNAL') || die();
require_once($CFG->dirroot . '/mod/interactivevideo/locallib.php');

/**
 * Class util
 *
 * @package    mod_flexbook
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class util extends \interactivevideo_util {
    /**
     * Get all activity types.
     *
     * @param bool $fromview Whether called from view.php.
     * @return array[] The list of activity types.
     */
    public static function get_all_activitytypes($fromview = false) {
        $subplugins = get_config('mod_flexbook', 'enablecontenttypes');
        $subplugins = explode(',', $subplugins);
        // If fromview, make sure to include ivplugin_chapter.
        if ($fromview && !in_array('ivplugin_chapter', $subplugins)) {
            $subplugins[] = 'ivplugin_chapter';
        }
        $subplugins = array_map(function ($subplugin) {
            return [
                'name' => $subplugin,
                'custom' => true,
                'class' => $subplugin . '\\main',
            ];
        }, $subplugins);

        $contentoptions = [];

        foreach ($subplugins as $subplugin) {
            $class = $subplugin['class'];

            if (!class_exists($class)) {
                continue;
            }

            $contenttype = new $class();
            if ($contenttype && $contenttype->can_used() && $contenttype->get_property()) {
                $properties = $contenttype->get_property();
                if (!isset($properties['flexbook']) || $properties['flexbook'] !== true) {
                    continue;
                }
                if (
                    !isset($properties['name']) || !isset($properties['class'])
                    || !isset($properties['amdmodule']) || !isset($properties['form'])
                ) {
                    continue;
                }
                if (!isset($properties['hascompletion'])) {
                    $properties['hascompletion'] = false;
                }
                if (!isset($properties['hastimestamp'])) {
                    $properties['hastimestamp'] = true;
                }
                if (!isset($properties['allowmultiple'])) {
                    $properties['allowmultiple'] = true;
                }
                if (!isset($properties['icon'])) {
                    $properties['icon'] = 'bi bi-cursor';
                }
                if (!isset($properties['title'])) {
                    $properties['title'] = get_string('unknowncontenttype', 'mod_interactivevideo');
                }
                if (!isset($properties['description'])) {
                    $properties['description'] = '';
                }
                if (!isset($properties['stringcomponent'])) {
                    $properties['stringcomponent'] = $subplugin['name'];
                }
                if (!isset($properties['initonreport'])) {
                    $properties['initonreport'] = false;
                }
                if (!isset($properties['preloadstrings'])) {
                    $properties['preloadstrings'] = true;
                }
                if ($fromview) { // Remove unneeded properties.
                    unset($properties['form']);
                    unset($properties['description']);
                    unset($properties['stringcomponent']);
                    unset($properties['initonreport']);
                    unset($properties['author']);
                    unset($properties['tutorial']);
                    unset($properties['pro']);
                }
                $contentoptions[] = $properties;
            }
        }

        // Make sure contentTypes do not have the same name key.
        $contentoptions = array_values(array_column($contentoptions, null, 'name'));
        return $contentoptions;
    }

    /**
     * Copy an interaction.
     *
     * @param int $id
     * @param int $contextid
     * @param float $timestamp
     * @return mixed|null
     */
    public static function copy_item($id, $contextid, $timestamp = 0): mixed {
        global $DB, $CFG;
        $record = $DB->get_record('flexbook_items', ['id' => $id]);
        $record->title = $record->title . ' (' . get_string('copynoun', 'mod_interactivevideo') . ')';
        $record->id = $DB->insert_record('flexbook_items', $record);
        // Handle related files in content, text1, text2, text3.
        require_once($CFG->libdir . '/filelib.php');
        $fs = get_file_storage();
        $contentfiles = $fs->get_area_files($contextid, 'mod_flexbook', 'content', $id, 'id ASC', false);
        $text1files = $fs->get_area_files($contextid, 'mod_flexbook', 'text1', $id, 'id ASC', false);
        $text2files = $fs->get_area_files($contextid, 'mod_flexbook', 'text2', $id, 'id ASC', false);
        $text3files = $fs->get_area_files($contextid, 'mod_flexbook', 'text3', $id, 'id ASC', false);

        // Merge the files.
        $files = array_merge($contentfiles, $text1files, $text2files, $text3files);
        foreach ($files as $file) {
            $filerecord = ['itemid' => $record->id];
            $fs->create_file_from_storedfile($filerecord, $file);
        }

        // Reset cache.
        $cache = \cache::make('mod_flexbook', 'fb_items');
        $cache->delete($record->cmid);

        return self::get_item($record->id, $contextid);
    }

    /**
     * Get all interactions in one interactive video module.
     *
     * @param int $cmid The course module ID.
     * @param int $contextid The context ID.
     * @param bool $hascompletion Whether to filter by completion.
     * @return array[] The list of items.
     */
    public static function get_items($cmid, $contextid, $hascompletion = false) {
        global $DB, $PAGE;
        $PAGE->set_context(\context::instance_by_id($contextid));
        $cache = \cache::make('mod_flexbook', 'fb_items');
        $items = $cache->get($cmid);
        if (!$items) {
            $items = $DB->get_records('flexbook_items', ['cmid' => $cmid]);
            $items = array_values($items);
            $cache->set($cmid, $items);
        }
        $items = (array)$items;
        if ($hascompletion) {
            $items = array_filter($items, function ($item) {
                return $item['hascompletion'] == 1;
            });
        }
        $items = array_map(function ($item) {
            $item = (array) $item;
            $item['formattedtitle'] = format_string($item['title']);
            return $item;
        }, $items);
        return $items;
    }

    /**
     * Get one interaction by id.
     *
     * @param int $id The item ID.
     * @param int $contextid The context ID.
     * @return \stdClass|null The item record.
     */
    public static function get_item($id, $contextid) {
        global $DB, $PAGE;
        $PAGE->set_context(\context::instance_by_id($contextid));
        $record = $DB->get_record('flexbook_items', ['id' => $id]);
        $record->formattedtitle = format_string($record->title);
        return $record;
    }

    /**
     * Delete an item.
     *
     * @param int $id The item ID.
     * @param int $cmid The course module ID.
     * @param int $contextid The context ID.
     * @return int The deleted item ID.
     */
    public static function delete_item($id, $cmid, $contextid) {
        global $DB;
        $DB->delete_records('flexbook_items', ['id' => $id]);
        $logs = $DB->get_records('flexbook_log', ['annotationid' => $id]);
        $fs = get_file_storage();
        // Delete files.
        $fs->delete_area_files($contextid, 'mod_flexbook', 'content', $id);
        $fs->delete_area_files($contextid, 'mod_flexbook', 'public', $id);
        $fs->delete_area_files($contextid, 'mod_flexbook', 'asset', $id);
        // Delete logs files & logs.
        if ($logs) {
            foreach ($logs as $log) {
                $fs->delete_area_files($contextid, 'mod_flexbook', 'attachments', $log->id);
                $fs->delete_area_files($contextid, 'mod_flexbook', 'text1', $log->id);
                $fs->delete_area_files($contextid, 'mod_flexbook', 'text2', $log->id);
                $fs->delete_area_files($contextid, 'mod_flexbook', 'text3', $log->id);
            }
            $DB->delete_records('flexbook_log', ['annotationid' => $id]);
        }
        $cache = \cache::make('mod_flexbook', 'fb_items');
        $cache->delete($cmid);

        return $id;
    }

    /**
     * Create a new interaction instance by routing to the plugin's own creation method.
     *
     * @param string $type The interaction type (plugin name).
     * @param array $data The data for the new instance.
     * @return \stdClass The newly created interaction record.
     */
    public static function create_instance($type, $data) {
        global $DB;
        $subplugins = self::get_all_activitytypes();
        $plugininfo = array_filter($subplugins, fn($p) => $p['name'] === $type);
        $plugininfo = reset($plugininfo);

        if (!$plugininfo || !class_exists($plugininfo['class'])) {
            throw new \moodle_exception('invalidinteractiontype', 'mod_flexbook', '', $type);
        }

        $class = $plugininfo['class'];
        $plugin = new $class();

        $anchorid = isset($data['anchorid']) ? (int) $data['anchorid'] : 0;
        unset($data['anchorid']);

        if (method_exists($plugin, 'create_instance')) {
            $item = $plugin->create_instance($data);
        } else {
            // Fallback for simple plugins: just insert into flexbook_items.
            $data = (object) $data;
            $data->id = $DB->insert_record('flexbook_items', $data);
            $item = self::get_item($data->id, $data->contextid);
        }

        // Handle sequence insertion.
        $flexbook = $DB->get_record('flexbook', ['id' => $item->flexbookid]);
        if ($flexbook) {
            $sequence = explode(',', $flexbook->sequence);
            $sequence = array_filter($sequence); // Remove empty values.

            if ($anchorid && ($index = array_search($anchorid, $sequence)) !== false) {
                // Insert after anchor.
                array_splice($sequence, $index + 1, 0, $item->id);
            } else {
                // Append to end.
                $sequence[] = $item->id;
            }

            $flexbook->sequence = implode(',', $sequence);
            $DB->update_record('flexbook', $flexbook);
        }

        // Clear cache.
        $cache = \cache::make('mod_flexbook', 'fb_items');
        $cache->delete($item->cmid);

        return $item;
    }

    /**
     * Quick edit a flexbook item
     *
     * @param int $id The item ID.
     * @param string $field The field name.
     * @param string $value The field value.
     * @param int $contextid The context ID.
     * @return \stdClass The updated item record.
     */
    public static function quick_edit($id, $field, $value, $contextid) {
        global $DB;
        $DB->set_field('flexbook_items', $field, $value, ['id' => $id]);
        $item = self::get_item($id, $contextid);
        $cache = \cache::make('mod_flexbook', 'fb_items');
        $cache->delete($item->cmid);
        return $item;
    }

    /**
     * Get progress data per user.
     *
     * @param int $cmid The course module ID.
     * @param int $userid The user ID.
     * @param int $courseid The course ID.
     * @param bool $preview Whether it's a preview mode.
     * @return array|\stdClass The progress data.
     */
    public static function get_progress($cmid, $userid, $courseid = null, $preview = false) {
        global $DB;
        if ($userid == 1 || $preview || isguestuser()) {
            global $SESSION;
            $progress = isset($SESSION->ivprogress) ? $SESSION->ivprogress : null;
            if (!isset($progress)) {
                $SESSION->ivprogress = [];
            }
            if (isset($progress[$cmid])) {
                return $progress[$cmid];
            } else {
                $SESSION->ivprogress[$cmid] = [
                    'cmid' => $cmid,
                    'completeditems' => '',
                    'xp' => 0,
                    'completionid' => 0,
                    'completionpercentage' => 0,
                    'userid' => $userid,
                    'completiondetails' => '',
                ];
            }
            return $SESSION->ivprogress[$cmid];
        }

        $record = $DB->get_record('flexbook_completion', ['cmid' => $cmid, 'userid' => $userid]);
        if (!$record) {
            $record = new \stdClass();
            $record->cmid = $cmid;
            $record->userid = $userid;
            $record->timecreated = time();
            $record->timecompleted = 0;
            $record->completeditems = '[]';
            $record->completionpercentage = 0;
            $record->completiondetails = '[]';
            $record->courseid = $courseid;
            $record->id = $DB->insert_record('flexbook_completion', $record);
            $new = true;
        }
        return [$record, isset($new) ? $new : false];
    }

    /**
     * Save the progress of an flexbook for a user.
     *
     * @param int $cmid The ID of the course module.
     * @param int $userid The ID of the user.
     * @param string $completeditems JSON encoded string of completed items.
     * @param string $completiondetails JSON encoded string of completion details.
     * @param bool $markdone Whether to mark the item as done.
     * @param string $type The type of the interactive video.
     * @param string $details Additional details (optional).
     * @param int $completed Whether the interactive video is completed (optional, default is 0).
     * @param float $percentage The completion percentage (optional, default is 0).
     * @param float $grade The grade achieved (optional, default is 0).
     * @param int $gradeiteminstance The grade item instance (optional, default is 0).
     * @param int $xp The experience points earned (optional, default is 0).
     * @param bool $updatestate Whether to update the completion state (optional, default is true).
     * @param int $courseid The ID of the course (optional, default is 0).
     * @return \stdClass The updated progress record.
     */
    public static function save_progress(
        $cmid,
        $userid,
        $completeditems,
        $completiondetails,
        $markdone,
        $type,
        $details = '',
        $completed = 0,
        $percentage = 0,
        $grade = 0,
        $gradeiteminstance = 0,
        $xp = 0,
        $updatestate = true,
        $courseid = 0
    ) {
        global $DB, $CFG, $SESSION;
        // If guess user, save progress in the session; otherwise in the database.
        if ($userid == 1 || isguestuser()) {
            // First get the progress from the session.
            $progress = [
                'cmid' => $cmid,
                'completeditems' => $completeditems,
                'completed' => $completed,
                'completionpercentage' => $percentage,
                'xp' => $xp,
                'userid' => $userid,
                'completionid' => 0,
            ];
            $currentprogress = $SESSION->ivprogress[$cmid] ?? null;
            if ($currentprogress) {
                $completion = json_decode($completiondetails);
                $cdetails = $currentprogress['completiondetails'];
                $cdetails = json_decode($cdetails);
                // Remove the detail item with the same id.
                $cdetails = array_filter($cdetails, function ($item) use ($completion) {
                    $item = json_decode($item);
                    return $item->id != $completion->id;
                });
                if ($markdone) {
                    $cdetails[] = $completiondetails;
                }
                $progress['completiondetails'] = json_encode($cdetails);
            }
            $SESSION->ivprogress[$cmid] = $progress;
            return $SESSION->ivprogress[$cmid];
        }
        $record = $DB->get_record('flexbook_completion', ['cmid' => $cmid, 'userid' => $userid]);
        $record->completeditems = $completeditems;
        $record->timecompleted = $completed ? time() : 0;
        $record->completionpercentage = round($percentage);
        $record->xp = $xp;
        $record->courseid = $courseid;
        $completion = json_decode($completiondetails);
        $cdetails = json_decode($record->completiondetails);
        // Remove the detail item with the same id.
        $cdetails = array_filter($cdetails, function ($item) use ($completion) {
            $item = json_decode($item);
            return $item->id != $completion->id;
        });
        if ($markdone) {
            $cdetails[] = $completiondetails;
        }
        $cdetails = array_values($cdetails);
        $record->completiondetails = json_encode($cdetails);
        $DB->update_record('flexbook_completion', $record);

        // Add/delete details to flexbook_log table.
        if ($completion->hasDetails) { // We don't want to query the database if there is no details.
            if (!$markdone) {
                $DB->delete_records_select('flexbook_log', "annotationid = :annotationid AND userid = :userid", [
                    'annotationid' => $completion->id,
                    'userid' => $userid,
                ]);
            } else {
                // Check if the log already exists.
                $existing = $DB->get_record('flexbook_log', [
                    'annotationid' => $completion->id,
                    'userid' => $userid,
                    'completionid' => $record->id,
                ]);
                if (!$existing) {
                    $log = new \stdClass();
                    $log->userid = $userid;
                    $log->cmid = $cmid;
                    $log->char1 = $type;
                    $log->annotationid = $completion->id;
                    $log->timecreated = time();
                    $log->text1 = $details;
                    $log->timemodified = time();
                    $log->completionid = $record->id;  // Store the completion id.
                    $DB->insert_record('flexbook_log', $log);
                } else {
                    $existing->text1 = $details;
                    $existing->timemodified = time();
                    $existing->completionid = $record->id;  // Store the completion id.
                    $DB->update_record('flexbook_log', $existing);
                }
            }
        }

        // Update grade.
        if ($gradeiteminstance > 0) {
            require_once($CFG->libdir . '/gradelib.php');
            $gradeitem = new \stdClass();
            $gradeitem->userid = $userid;
            $gradeitem->rawgrade = $grade;
            if ($grade <= 0) {
                $gradeitem->rawgrade = null;
            }
            grade_update('mod/flexbook', $courseid, 'mod', 'flexbook', $gradeiteminstance, 0, $gradeitem);

            $record->grade = $grade;
            $record->gradeiteminstance = $gradeiteminstance;
            $record->gradeitem = $gradeitem;
        }

        // Update completion state.
        if ($updatestate) {
            $modinfo = get_fast_modinfo($courseid);
            $cm = $modinfo->get_cm($cmid);
            if ($cm->completion > 1) {
                require_once($CFG->libdir . '/completionlib.php');
                $course = new \stdClass();
                $course->id = $courseid;
                $completion = new \completion_info($course);
                $completion->update_state($cm);
                $record->overallcomplete = $completion->internal_get_state($cm, $userid, null);
            }
        }

        return $record;
    }

    /**
     * Get report data by group.
     *
     * @param int $cmid
     * @param int $group
     * @param int $contextid
     * @param int $courseid
     * @return array
     */
    public static function get_report_data_by_group($cmid, $group, $contextid, $courseid = 0) {
        global $DB, $OUTPUT, $PAGE, $CFG;
        require_once($CFG->dirroot . '/user/profile/lib.php');
        require_once($CFG->dirroot . '/user/lib.php');
        $context = \context::instance_by_id($contextid);
        $PAGE->set_context($context);

        if (!$courseid) {
            $cm = get_coursemodule_from_id('flexbook', $cmid);
            $courseid = $cm->course;
        }
        $coursecontext = \context_course::instance($courseid);
        // Get fields for userpicture.
        $fields = \core_user\fields::get_picture_fields();
        $identityfields = get_config('mod_flexbook', 'reportfields');
        if (!empty($identityfields)) {
            $fields = array_merge($fields, explode(',', $identityfields));
        }
        $customfields = array_filter($fields, function ($field) {
            return strpos($field, 'profile_field_') !== false;
        });
        $corefields = array_filter($fields, function ($field) {
            return strpos($field, 'profile_field_') === false;
        });
        $dbfields = 'u.' . implode(', u.', $corefields);
        // Graded roles.
        $roles = get_config('core', 'gradebookroles');
        if (empty($roles)) {
            return [];
        }
        [$inparams, $inparamsvalues] = $DB->get_in_or_equal(explode(',', $roles));
        if ($group == 0) {
            // Get all enrolled users (student only).
            $sql = "SELECT " . $dbfields . ", ac.timecompleted, ac.timecreated,
             ac.completionpercentage, ac.completeditems, ac.xp, ac.completiondetails, ac.id as completionid
                    FROM {user} u
                    LEFT JOIN {flexbook_completion} ac ON ac.userid = u.id AND ac.cmid = ?
                    WHERE u.id IN (SELECT userid FROM {role_assignments} WHERE contextid = ? AND roleid $inparams)
                    ORDER BY u.lastname, u.firstname";
            $params = array_merge([$cmid, $coursecontext->id], $inparamsvalues);
            $records = $DB->get_records_sql($sql, $params);
        } else {
            // Get users in group (student only).
            $sql = "SELECT " . $dbfields . ", ac.timecompleted, ac.timecreated,
             ac.completionpercentage, ac.completeditems, ac.xp, ac.completiondetails, ac.id as completionid
                    FROM {user} u
                    LEFT JOIN {flexbook_completion} ac ON ac.userid = u.id AND ac.cmid = ?
                    WHERE u.id IN (SELECT userid FROM {groups_members} WHERE groupid = ?)
                    AND u.id IN (SELECT userid FROM {role_assignments} WHERE contextid = ? AND roleid $inparams)
                    ORDER BY u.lastname, u.firstname";
            $params = array_merge([$cmid, $group, $coursecontext->id], $inparamsvalues);
            $records = $DB->get_records_sql($sql, $params);
        }

        // Render the photo of the user.
        foreach ($records as $record) {
            $userpic = new \user_picture($record);
            $userpic->link = false;
            $userpic->includefullname = true;
            $record->pictureonly = $OUTPUT->render($userpic);
            $userpic->courseid = $courseid;
            $userpic->link = true;
            $userpic->popup = true;
            $record->picture = $OUTPUT->render($userpic);
            $record->fullname = fullname($record);

            // Handle custom fields.
            if (!empty($customfields)) {
                foreach ($customfields as $field) {
                    $record->{$field} = '';
                }
                $profile = user_get_user_details($record, null, ['customfields']);
                $customfieldarray = (array)$profile['customfields'];
                foreach ($customfieldarray as $key => $value) {
                    $field = (object)$value;
                    if (in_array('profile_field_' . $field->shortname, $customfields)) {
                        $record->{'profile_field_' . $field->shortname} = $field->displayvalue;
                        unset($customfieldarray[$key]['displayvalue']);
                        unset($customfieldarray[$key]['name']);
                    } else {
                        unset($customfieldarray[$key]);
                    }
                }
                $record->customfields = $customfieldarray;
            }
        }
        return $records;
    }

    /**
     * Delete progress by ID.
     *
     * @param int $contextid
     * @param int $recordid
     * @param int $courseid
     * @param int $cmid
     * @return string
     */
    public static function delete_progress_by_id($contextid, $recordid, $courseid, $cmid) {
        global $DB, $CFG;
        $DB->delete_records('flexbook_completion', ['id' => $recordid]);
        $logs = $DB->get_records('flexbook_log', ['completionid' => $recordid], 'id', 'id, userid');
        if ($logs) {
            $fs = get_file_storage();
            foreach ($logs as $log) {
                $fs->delete_area_files($contextid, 'mod_flexbook', 'attachments', $log->id);
                $fs->delete_area_files($contextid, 'mod_flexbook', 'text1', $log->id);
                $fs->delete_area_files($contextid, 'mod_flexbook', 'text2', $log->id);
                $fs->delete_area_files($contextid, 'mod_flexbook', 'text3', $log->id);
            }
            $DB->delete_records('flexbook_log', ['completionid' => $recordid]);
        }
        $userids = array_column($logs, 'userid');
        $userids = array_unique($userids);
        $userids = array_values($userids);
        $cm = get_coursemodule_from_id('flexbook', $cmid);
        require_once($CFG->libdir . '/completionlib.php');
        if ($cm->completion == COMPLETION_TRACKING_AUTOMATIC) {
            $course = new \stdClass();
            $course->id = $courseid;
            $completion = new \completion_info($course);
            foreach ($userids as $userid) {
                $completion->update_state($cm, null, $userid);
            }
        }
        return 'deleted';
    }

    /**
     * Delete progress by IDs.
     *
     * @param int $contextid
     * @param array $recordids
     * @param int $courseid
     * @param int $cmid
     * @return string
     */
    public static function delete_progress_by_ids($contextid, $recordids, $courseid, $cmid) {
        global $DB, $CFG;
        $DB->delete_records_list('flexbook_completion', 'id', $recordids);
        $logs = $DB->get_records_list('flexbook_log', 'completionid', $recordids, 'id', 'id, userid');
        if ($logs) {
            $fs = get_file_storage();
            foreach ($logs as $log) {
                $fs->delete_area_files($contextid, 'mod_flexbook', 'attachments', $log->id);
                $fs->delete_area_files($contextid, 'mod_flexbook', 'text1', $log->id);
                $fs->delete_area_files($contextid, 'mod_flexbook', 'text2', $log->id);
                $fs->delete_area_files($contextid, 'mod_flexbook', 'text3', $log->id);
            }
            $DB->delete_records_list('flexbook_log', 'completionid', $recordids);
        }
        $cm = get_coursemodule_from_id('flexbook', $cmid);
        require_once($CFG->libdir . '/completionlib.php');
        if ($cm->completion == COMPLETION_TRACKING_AUTOMATIC) {
            $course = new \stdClass();
            $course->id = $courseid;
            $completion = new \completion_info($course);
            $userids = array_column($logs, 'userid');
            $userids = array_unique($userids);
            $userids = array_values($userids);
            foreach ($userids as $userid) {
                $completion->update_state($cm, null, $userid);
            }
        }
        return 'deleted';
    }

    /**
     * Delete completion data.
     *
     * @param int $id
     * @param int $itemid
     * @param int $userid
     * @param int $contextid
     * @return string
     */
    public static function delete_completion_data($id, $itemid, $userid, $contextid) {
        global $DB;
        $completion = $DB->get_record('flexbook_completion', ['id' => $id]);
        if ($completion) {
            $completeditems = json_decode($completion->completeditems);
            $key = array_search($itemid, $completeditems);
            if ($key !== false) {
                unset($completeditems[$key]);
                $completion->completeditems = json_encode(array_values($completeditems));
            }
            $completiondetails = json_decode($completion->completiondetails);
            $completiondetails = array_map(function ($item) use ($itemid) {
                $decoded = json_decode($item);
                if ($decoded->id == $itemid) {
                    $new = [
                        'id' => $decoded->id,
                        'deleted' => true,
                    ];
                    return json_encode($new);
                }
                return json_encode($decoded);
            }, $completiondetails);
            $completion->completiondetails = json_encode(array_values($completiondetails));
            // Remove from details (timespent and views).
            $details = json_decode($completion->details, true);
            if (is_array($details) && isset($details[$itemid])) {
                unset($details[$itemid]);
                $completion->details = json_encode($details);
            }
            $DB->update_record('flexbook_completion', $completion);
            $logs = $DB->get_records('flexbook_log', ['userid' => $userid, 'annotationid' => $itemid]);
            $fs = get_file_storage();
            if ($logs) {
                foreach ($logs as $log) {
                    $fs->delete_area_files($contextid, 'mod_flexbook', 'attachments', $log->id);
                    $fs->delete_area_files($contextid, 'mod_flexbook', 'text1', $log->id);
                    $fs->delete_area_files($contextid, 'mod_flexbook', 'text2', $log->id);
                    $fs->delete_area_files($contextid, 'mod_flexbook', 'text3', $log->id);
                }
                $DB->delete_records('flexbook_log', ['userid' => $userid, 'annotationid' => $itemid]);
            }
            return json_encode(['id' => $id, 'itemid' => $itemid]);
        } else {
            return json_encode(['error' => 'Completion record not found']);
        }
    }

    /**
     * Save log.
     *
     * @param int $userid The user ID.
     * @param int $annotationid The annotation ID.
     * @param int $cmid The course module ID.
     * @param string $data The log data.
     * @param int $contextid The context ID.
     * @param int $replace Whether to replace existing log.
     * @return \stdClass The saved log record.
     */
    public static function save_log($userid, $annotationid, $cmid, $data, $contextid, $replace) {
        global $DB;
        $record = json_decode($data);
        $record->userid = $userid;
        $record->annotationid = $annotationid;
        $record->cmid = $cmid;
        $record->timecreated = time();
        $record->timemodified = time();
        if ($replace) {
            $existingrecord = $DB->get_record('flexbook_log', ['userid' => $userid, 'annotationid' => $annotationid]);
            if ($existingrecord) {
                $record->id = $existingrecord->id;
                $record->timemodified = time();
                $DB->update_record('flexbook_log', $record);
            } else {
                $record->id = $DB->insert_record('flexbook_log', $record);
            }
        } else {
            $record->id = $DB->insert_record('flexbook_log', $record);
        }
        $record->formattedtimecreated = userdate($record->timecreated, get_string('strftimedatetime'));
        $record->formattedtimemodified = userdate($record->timemodified, get_string('strftimedatetime'));

        return $record;
    }

    /**
     * Get logs by userids.
     *
     * @param array $userids
     * @param int $annotationid
     * @param int $contextid
     * @param string $type
     * @param int $cmid
     * @return array
     */
    public static function get_logs_by_userids($userids, $annotationid, $contextid, $type, $cmid) {
        global $DB, $CFG;
        require_once($CFG->libdir . '/filelib.php');
        $inparams = $DB->get_in_or_equal($userids)[1];
        $inparams = implode(',', $inparams);
        $where = '';
        if ($annotationid != 0) {
            $where = "annotationid = ? ";
        }
        if ($type) {
            $where .= ($where ? ' AND ' : '') . "char1 = ? AND cmid = ?";
        }
        $sql = "SELECT * FROM {flexbook_log} WHERE {$where} AND userid IN ($inparams) ORDER BY
        timecreated DESC";
        $params = [];
        if ($annotationid != 0) {
            $params[] = $annotationid;
        }
        if ($type) {
            $params[] = $type;
            $params[] = $cmid;
        }
        $records = $DB->get_records_sql($sql, $params);
        foreach ($records as $record) {
            $record->formattedtimecreated = userdate($record->timecreated, get_string('strftimedatetime'));
            $record->formattedtimemodified = userdate($record->timemodified, get_string('strftimedatetime'));
            $record->text1 = self::process_text($record->text1, $contextid, 'text1', $record->id);
            $record->text2 = self::process_text($record->text2, $contextid, 'text2', $record->id);
            $record->text3 = self::process_text($record->text3, $contextid, 'text3', $record->id);
        }
        return array_values($records);
    }

    /**
     * Processes the given text within a specific context.
     *
     * @param string $text The text to be processed.
     * @param int $contextid The ID of the context in which the text is being processed.
     * @param string $field The field associated with the text.
     * @param int $id The ID related to the text processing.
     *
     * @return string The processed text.
     */
    public static function process_text($text, $contextid, $field, $id) {
        if (!$text) {
            return $text;
        }
        $text = file_rewrite_pluginfile_urls(
            str_replace('\\/', '/', $text),
            'pluginfile.php',
            $contextid,
            'mod_flexbook',
            $field,
            $id
        );
        $text = self::encode_text($text);
        return $text;
    }

    /**
     * Render a hidden div with the Moodle version branch.
     *
     * @return string The HTML for the hidden div.
     */
    public static function render_moodle_version() {
        global $CFG;
        return '<div id="mod_flexbook_moodle_version" class="d-none" data-version="' . $CFG->branch . '"></div>';
    }
}
