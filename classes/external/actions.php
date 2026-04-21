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

namespace mod_flexbook\external;

defined('MOODLE_INTERNAL') || die();

use external_function_parameters;
use external_single_structure;
use external_api;
use external_value;
use mod_flexbook\util;

require_once($CFG->libdir . '/externallib.php');

/**
 * Class actions
 *
 * @package    mod_flexbook
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class actions extends external_api {
    /**
     * Default parameters
     *
     * @return external_function_parameters
     */
    public static function default_parameters() {
        return new external_function_parameters([
            'contextid' => new external_value(PARAM_INT, 'The context ID', VALUE_REQUIRED),
            'id' => new external_value(PARAM_INT, 'The ID of the item to be duplicated', VALUE_REQUIRED),
        ]);
    }

    /**
     * Duplicate parameters
     *
     * @return external_function_parameters
     */
    public static function default_returns() {
        return new external_single_structure([
            'status' => new external_value(PARAM_TEXT, 'The status of the duplication'),
            'data' => new external_value(PARAM_RAW, 'The data of the duplicated item in JSON format'),
        ]);
    }

    /**
     * Validate edit permission
     *
     * @param mixed $contextid
     * @return void
     */
    public static function validate_edit_context($contextid) {
        $context = \context::instance_by_id($contextid);

        // Check if the user has permission to manage this item.
        if (!has_capability('mod/flexbook:edit', $context)) {
            throw new \moodle_exception('nopermission', 'error', '', $context->id);
        }
    }

    /**
     * Validate view permission
     *
     * @param mixed $contextid
     * @return void
     */
    public static function validate_view_context($contextid) {
        $context = \context::instance_by_id($contextid);

        // Check if the user has permission to manage this item.
        if (!has_capability('mod/flexbook:view', $context)) {
            throw new \moodle_exception('nopermission', 'error', '', $context->id);
        }
    }

    /**
     * Duplicate parameters
     *
     * @return external_function_parameters
     */
    public static function duplicate_parameters() {
        return self::default_parameters();
    }

    /**
     * Duplicate parameters
     *
     * @return external_function_parameters
     */
    public static function duplicate_returns() {
        return self::default_returns();
    }

    /**
     * Duplicate a flexbook item
     *
     * @param int $contextid The context ID where the item will be duplicated.
     * @param int $id The ID of the item to be duplicated.
     * @return array The result of the duplication.
     * @throws \moodle_exception If the user is not logged in or does not have permission.
     */
    public static function duplicate($contextid, $id) {
        self::validate_parameters(self::duplicate_parameters(), ['contextid' => $contextid, 'id' => $id]);

        self::validate_edit_context($contextid);

        $item = util::copy_item($id, $contextid);

        return ['status' => 'success', 'data' => json_encode($item)];
    }

    /**
     * Delete parameters
     *
     * @return external_function_parameters
     */
    public static function delete_parameters() {
        return new external_function_parameters([
            'contextid' => new external_value(PARAM_INT, 'The context ID', VALUE_REQUIRED),
            'id' => new external_value(PARAM_INT, 'The ID of the item to be duplicated', VALUE_REQUIRED),
            'cmid' => new external_value(PARAM_INT, 'The course module ID', VALUE_REQUIRED),
        ]);
    }

    /**
     * Delete a flexbook item
     *
     * @param mixed $contextid The context ID where the item will be deleted.
     * @param mixed $id The ID of the item to be deleted.
     * @param mixed $cmid The course module ID.
     * @return void
     */
    public static function delete($contextid, $id, $cmid) {
        self::validate_parameters(self::delete_parameters(), ['contextid' => $contextid, 'id' => $id, 'cmid' => $cmid]);

        self::validate_edit_context($contextid);

        util::delete_item($id, $cmid, $contextid);

        return ['status' => 'success', 'data' => $id];
    }

    /**
     * Delete parameters
     *
     * @return external_function_parameters
     */
    public static function delete_returns() {
        return new external_single_structure([
            'status' => new external_value(PARAM_TEXT, 'The status of the deletion'),
            'data' => new external_value(PARAM_INT, 'The ID of the deleted item'),
        ]);
    }

    /**
     * Update sequence parameters
     *
     * @return external_function_parameters
     */
    public static function update_sequence_parameters() {
        return new external_function_parameters([
            'contextid' => new external_value(PARAM_INT, 'The context ID', VALUE_REQUIRED),
            'instanceid' => new external_value(PARAM_INT, 'The flexbook instance ID', VALUE_REQUIRED),
            'sequence' => new external_value(PARAM_TEXT, 'The sequence of the item', VALUE_REQUIRED),
        ]);
    }

    /**
     * Update sequence of a flexbook item
     *
     * @param int $contextid The context ID where the item will be deleted.
     * @param int $instanceid The flexbook instance ID.
     * @param mixed $sequence The sequence of the item.
     * @return void
     */
    public static function update_sequence($contextid, $instanceid, $sequence) {
        global $DB;
        self::validate_parameters(self::update_sequence_parameters(), [
            'contextid' => $contextid,
            'instanceid' => $instanceid,
            'sequence' => $sequence,
        ]);

        self::validate_edit_context($contextid);

        $instanceid = (int) $instanceid;
        $sequence = $sequence;

        $DB->set_field('flexbook', 'sequence', $sequence, ['id' => $instanceid]);

        return ['status' => 'success', 'data' => $sequence];
    }

    /**
     * Update sequence return fields
     *
     * @return external_description
     */
    public static function update_sequence_returns() {
        return new external_single_structure([
            'status' => new external_value(PARAM_TEXT, 'The status of the update'),
            'data' => new external_value(PARAM_TEXT, 'The sequence of the item'),
        ]);
    }

    /**
     * Quick edit parameters
     *
     * @return external_function_parameters
     */
    public static function quick_edit_parameters() {
        return new external_function_parameters([
            'contextid' => new external_value(PARAM_INT, 'The context ID', VALUE_REQUIRED),
            'id' => new external_value(PARAM_INT, 'The ID of the item to be edited'),
            'field' => new external_value(PARAM_TEXT, 'The field to be edited'),
            'value' => new external_value(PARAM_TEXT, 'The value of the field'),
        ]);
    }

    /**
     * Quick edit parameters
     *
     * @return external_function_parameters
     */
    public static function quick_edit_returns() {
        return new external_single_structure([
            'status' => new external_value(PARAM_TEXT, 'The status of the update'),
            'data' => new external_value(PARAM_RAW, 'The data of the edited item in JSON format'),
        ]);
    }

    /**
     * Quick edit a flexbook item
     *
     * @param int $contextid The context ID where the item will be updated.
     * @param int $id The ID of the item to be updated.
     * @param string $field The field to be updated.
     * @param string $value The value of the field.
     * @return array The result of the quick edit.
     * @throws \moodle_exception If the user is not logged in or does not have permission.
     */
    public static function quick_edit($contextid, $id, $field, $value) {
        global $DB;

        self::validate_parameters(self::quick_edit_parameters(), [
            'contextid' => $contextid,
            'id' => $id,
            'field' => $field,
            'value' => $value,
        ]);

        self::validate_edit_context($contextid);

        $item = util::quick_edit($id, $field, $value, $contextid);

        return ['status' => 'success', 'data' => json_encode($item)];
    }

    /**
     * Save progress parameters
     *
     * @return external_function_parameters
     */
    public static function save_progress_parameters() {
        return new external_function_parameters([
            'contextid' => new external_value(PARAM_INT, 'The context ID', VALUE_REQUIRED),
            'id' => new external_value(PARAM_INT, 'The ID of the item to be edited'),
            'markdone' => new external_value(PARAM_BOOL, 'Whether to mark the item as done'),
            'uid' => new external_value(PARAM_INT, 'The user ID'),
            'percentage' => new external_value(PARAM_FLOAT, 'The completion percentage'),
            'g' => new external_value(PARAM_FLOAT, 'The grade'),
            'gradeiteminstance' => new external_value(PARAM_INT, 'The grade item instance ID'),
            'c' => new external_value(PARAM_INT, 'The completion status'),
            'xp' => new external_value(PARAM_INT, 'The experience'),
            'completeditems' => new external_value(PARAM_TEXT, 'The completed items'),
            'completiondetails' => new external_value(PARAM_TEXT, 'The completion details'),
            'details' => new external_value(PARAM_TEXT, 'The details'),
            'annotationtype' => new external_value(PARAM_TEXT, 'The annotation type'),
            'cmid' => new external_value(PARAM_INT, 'The course module ID'),
            'completionid' => new external_value(PARAM_INT, 'The completion ID'),
            'updatestate' => new external_value(PARAM_INT, 'The updatestate'),
            'courseid' => new external_value(PARAM_INT, 'The course ID'),
        ]);
    }

    /**
     * Save progress of a flexbook item
     *
     * @param int $contextid The context ID where the item will be updated.
     * @param int $id The ID of the item to be updated.
     * @param bool $markdone Whether to mark the item as done.
     * @param int $uid The user ID.
     * @param float $percentage The completion percentage.
     * @param float $g The grade.
     * @param int $gradeiteminstance The grade item instance ID.
     * @param int $c The completion status.
     * @param int $xp The experience.
     * @param string $completeditems The completed items.
     * @param string $completiondetails The completion details.
     * @param string $details The details.
     * @param string $annotationtype The annotation type.
     * @param int $cmid The course module ID.
     * @param int $completionid The completion ID.
     * @param int $updatestate The updatestate.
     * @param int $courseid The course ID.
     * @return array The result of the save progress.
     * @throws \moodle_exception If the user is not logged in or does not have permission.
     */
    public static function save_progress(
        $contextid,
        $id,
        $markdone,
        $uid,
        $percentage,
        $g,
        $gradeiteminstance,
        $c,
        $xp,
        $completeditems,
        $completiondetails,
        $details,
        $annotationtype,
        $cmid,
        $completionid,
        $updatestate,
        $courseid
    ) {
        global $DB;
        self::validate_parameters(self::save_progress_parameters(), [
            'contextid' => $contextid,
            'id' => $id,
            'markdone' => $markdone,
            'uid' => $uid,
            'percentage' => $percentage,
            'g' => $g,
            'gradeiteminstance' => $gradeiteminstance,
            'c' => $c,
            'xp' => $xp,
            'completeditems' => $completeditems,
            'completiondetails' => $completiondetails,
            'details' => $details,
            'annotationtype' => $annotationtype,
            'cmid' => $cmid,
            'completionid' => $completionid,
            'updatestate' => $updatestate,
            'courseid' => $courseid,
        ]);

        self::validate_view_context($contextid);

        $progress = util::save_progress(
            $cmid,
            $uid,
            $completeditems,
            $completiondetails,
            $markdone,
            $annotationtype,
            $details,
            $c,
            $percentage,
            $g,
            $gradeiteminstance,
            $xp,
            $updatestate,
            $courseid
        );

        return ['status' => 'success', 'data' => json_encode($progress)];
    }

    /**
     * Return the description of the return value of save_progress function
     * @return external_description
     */
    public static function save_progress_returns() {
        return new external_single_structure([
            'status' => new external_value(PARAM_TEXT, 'The status of the save progress'),
            'data' => new external_value(PARAM_RAW, 'The data of the saved progress in JSON format'),
        ]);
    }

    /**
     * Save interaction data parameters
     *
     * @return external_function_parameters
     */
    public static function save_interaction_data_parameters() {
        return new external_function_parameters([
            'contextid' => new external_value(PARAM_INT, 'The context ID', VALUE_REQUIRED),
            'completionid' => new external_value(PARAM_INT, 'The completion record ID', VALUE_REQUIRED),
            'details' => new external_value(PARAM_TEXT, 'JSON encoded interaction data (timespent + views)', VALUE_REQUIRED),
            'lastviewed' => new external_value(PARAM_INT, 'Last viewed annotation ID', VALUE_DEFAULT, 0),
        ]);
    }

    /**
     * Save lightweight interaction data (timespent, views, lastviewed) without touching completion state.
     *
     * @param int $contextid The context ID.
     * @param int $completionid The flexbook_completion record ID.
     * @param string $details JSON encoded object with timespent and views maps.
     * @param int $lastviewed Last annotation ID the user viewed.
     * @return array
     */
    public static function save_interaction_data($contextid, $completionid, $details, $lastviewed = 0) {
        global $DB;
        self::validate_parameters(self::save_interaction_data_parameters(), [
            'contextid' => $contextid,
            'completionid' => $completionid,
            'details' => $details,
            'lastviewed' => $lastviewed,
        ]);

        self::validate_view_context($contextid);

        if ($completionid > 0) {
            $DB->set_field('flexbook_completion', 'details', $details, ['id' => $completionid]);
            if ($lastviewed > 0) {
                $DB->set_field('flexbook_completion', 'lastviewed', $lastviewed, ['id' => $completionid]);
            }
        }

        return ['status' => 'success', 'data' => json_encode(['details' => $details, 'lastviewed' => $lastviewed])];
    }

    /**
     * Return the description of the return value of save_interaction_data function.
     *
     * @return external_description
     */
    public static function save_interaction_data_returns() {
        return new external_single_structure([
            'status' => new external_value(PARAM_TEXT, 'The status'),
            'data' => new external_value(PARAM_RAW, 'The saved data as JSON'),
        ]);
    }

    /**
     * Get report data parameters
     *
     * @return external_function_parameters
     */
    public static function get_report_data_parameters() {
        return new external_function_parameters([
            'contextid' => new external_value(PARAM_INT, 'The context ID', VALUE_REQUIRED),
            'cmid' => new external_value(PARAM_INT, 'The course module ID', VALUE_REQUIRED),
            'groupid' => new external_value(PARAM_INT, 'The group ID', VALUE_DEFAULT, 0),
            'courseid' => new external_value(PARAM_INT, 'The course ID', VALUE_DEFAULT, 0),
        ]);
    }

    /**
     * Get report data
     *
     * @param int $contextid The context ID.
     * @param int $cmid The flexbook instance ID.
     * @param int $groupid The group ID.
     * @param int $courseid The course ID.
     * @return array
     */
    public static function get_report_data($contextid, $cmid, $groupid = 0, $courseid = 0) {
        self::validate_parameters(self::get_report_data_parameters(), [
            'contextid' => $contextid,
            'cmid' => $cmid,
            'groupid' => $groupid,
            'courseid' => $courseid,
        ]);

        $context = \context::instance_by_id($contextid);
        if (!has_capability('mod/flexbook:viewreport', $context)) {
            throw new \moodle_exception('nopermission', 'error', '', $context->id);
        }

        $records = util::get_report_data_by_group($cmid, $groupid, $contextid, $courseid);

        return ['status' => 'success', 'data' => json_encode(array_values($records))];
    }

    /**
     * Get report data returns
     *
     * @return external_description
     */
    public static function get_report_data_returns() {
        return new external_single_structure([
            'status' => new external_value(PARAM_TEXT, 'The status'),
            'data' => new external_value(PARAM_RAW, 'The report data as JSON'),
        ]);
    }

    /**
     * Delete progress parameters
     *
     * @return external_function_parameters
     */
    public static function delete_progress_parameters() {
        return new external_function_parameters([
            'contextid' => new external_value(PARAM_INT, 'The context ID', VALUE_REQUIRED),
            'cmid' => new external_value(PARAM_INT, 'The course module ID', VALUE_REQUIRED),
            'recordids' => new external_value(PARAM_TEXT, 'Comma separated completion record IDs', VALUE_REQUIRED),
            'courseid' => new external_value(PARAM_INT, 'The course ID', VALUE_REQUIRED),
        ]);
    }

    /**
     * Delete progress
     *
     * @param int $contextid The context ID.
     * @param int $cmid The course module ID.
     * @param string $recordids Comma separated completion record IDs.
     * @param int $courseid The course ID.
     * @return array
     */
    public static function delete_progress($contextid, $cmid, $recordids, $courseid) {
        self::validate_parameters(self::delete_progress_parameters(), [
            'contextid' => $contextid,
            'cmid' => $cmid,
            'recordids' => $recordids,
            'courseid' => $courseid,
        ]);

        $context = \context::instance_by_id($contextid);
        if (!has_capability('mod/flexbook:editreport', $context)) {
            throw new \moodle_exception('nopermission', 'error', '', $context->id);
        }

        $ids = explode(',', $recordids);
        if (count($ids) == 1) {
            util::delete_progress_by_id($contextid, $ids[0], $courseid, $cmid);
        } else {
            util::delete_progress_by_ids($contextid, $ids, $courseid, $cmid);
        }

        return ['status' => 'success', 'data' => 'deleted'];
    }

    /**
     * Delete progress returns
     *
     * @return external_description
     */
    public static function delete_progress_returns() {
        return new external_single_structure([
            'status' => new external_value(PARAM_TEXT, 'The status'),
            'data' => new external_value(PARAM_TEXT, 'The data'),
        ]);
    }

    /**
     * Delete completion data parameters
     *
     * @return external_function_parameters
     */
    public static function delete_completion_data_parameters() {
        return new external_function_parameters([
            'contextid' => new external_value(PARAM_INT, 'The context ID', VALUE_REQUIRED),
            'id' => new external_value(PARAM_INT, 'The completion ID', VALUE_REQUIRED),
            'itemid' => new external_value(PARAM_INT, 'The item ID', VALUE_REQUIRED),
            'userid' => new external_value(PARAM_INT, 'The user ID', VALUE_REQUIRED),
        ]);
    }

    /**
     * Delete completion data
     *
     * @param int $contextid The context ID.
     * @param int $id The completion ID.
     * @param int $itemid The item ID.
     * @param int $userid The user ID.
     * @return array
     */
    public static function delete_completion_data($contextid, $id, $itemid, $userid) {
        self::validate_parameters(self::delete_completion_data_parameters(), [
            'contextid' => $contextid,
            'id' => $id,
            'itemid' => $itemid,
            'userid' => $userid,
        ]);

        $context = \context::instance_by_id($contextid);
        if (!has_capability('mod/flexbook:editreport', $context)) {
            throw new \moodle_exception('nopermission', 'error', '', $context->id);
        }

        $result = util::delete_completion_data($id, $itemid, $userid, $contextid);

        return ['status' => 'success', 'data' => $result];
    }

    /**
     * Delete completion data returns
     *
     * @return external_description
     */
    public static function delete_completion_data_returns() {
        return new external_single_structure([
            'status' => new external_value(PARAM_TEXT, 'The status'),
            'data' => new external_value(PARAM_RAW, 'The data as JSON string'),
        ]);
    }

    /**
     * Get logs parameters
     *
     * @return external_function_parameters
     */
    public static function get_logs_parameters() {
        return new external_function_parameters([
            'contextid' => new external_value(PARAM_INT, 'The context ID', VALUE_REQUIRED),
            'userids' => new external_value(PARAM_TEXT, 'Comma separated user IDs', VALUE_REQUIRED),
            'annotationid' => new external_value(PARAM_INT, 'The annotation ID', VALUE_REQUIRED),
            'type' => new external_value(PARAM_TEXT, 'The type of the log', VALUE_DEFAULT, ''),
            'cmid' => new external_value(PARAM_INT, 'The course module ID', VALUE_DEFAULT, 0),
        ]);
    }

    /**
     * Get logs
     *
     * @param int $contextid The context ID.
     * @param string $userids Comma separated user IDs.
     * @param int $annotationid The annotation ID.
     * @param string $type The type of the log.
     * @param int $cmid The course module ID.
     * @return array
     */
    public static function get_logs($contextid, $userids, $annotationid, $type = '', $cmid = 0) {
        self::validate_parameters(self::get_logs_parameters(), [
            'contextid' => $contextid,
            'userids' => $userids,
            'annotationid' => $annotationid,
            'type' => $type,
            'cmid' => $cmid,
        ]);

        self::validate_view_context($contextid);

        $userids = explode(',', $userids);
        $logs = util::get_logs_by_userids($userids, $annotationid, $contextid, $type, $cmid);

        return ['status' => 'success', 'data' => json_encode($logs)];
    }

    /**
     * Get logs returns
     *
     * @return external_description
     */
    public static function get_logs_returns() {
        return new external_single_structure([
            'status' => new external_value(PARAM_TEXT, 'The status'),
            'data' => new external_value(PARAM_RAW, 'The logs as JSON string'),
        ]);
    }

    /**
     * Save log parameters
     *
     * @return external_function_parameters
     */
    public static function save_log_parameters() {
        return new external_function_parameters([
            'contextid' => new external_value(PARAM_INT, 'The context ID', VALUE_REQUIRED),
            'userid' => new external_value(PARAM_INT, 'The user ID', VALUE_REQUIRED),
            'annotationid' => new external_value(PARAM_INT, 'The annotation ID', VALUE_REQUIRED),
            'cmid' => new external_value(PARAM_INT, 'The course module ID', VALUE_REQUIRED),
            'data' => new external_value(PARAM_RAW, 'The data of the log in JSON format', VALUE_REQUIRED),
            'replaceexisting' => new external_value(PARAM_INT, 'Whether to replace existing log', VALUE_DEFAULT, 0),
        ]);
    }

    /**
     * Save log
     *
     * @param int $contextid The context ID.
     * @param int $userid The user ID.
     * @param int $annotationid The annotation ID.
     * @param int $cmid The course module ID.
     * @param string $data The data of the log in JSON format.
     * @param int $replaceexisting Whether to replace existing log.
     * @return array
     */
    public static function save_log($contextid, $userid, $annotationid, $cmid, $data, $replaceexisting = 0) {
        self::validate_parameters(self::save_log_parameters(), [
            'contextid' => $contextid,
            'userid' => $userid,
            'annotationid' => $annotationid,
            'cmid' => $cmid,
            'data' => $data,
            'replaceexisting' => $replaceexisting,
        ]);

        self::validate_view_context($contextid);

        $log = util::save_log($userid, $annotationid, $cmid, $data, $contextid, $replaceexisting);

        return ['status' => 'success', 'data' => json_encode($log)];
    }

    /**
     * Save log returns
     *
     * @return external_description
     */
    public static function save_log_returns() {
        return new external_single_structure([
            'status' => new external_value(PARAM_TEXT, 'The status'),
            'data' => new external_value(PARAM_RAW, 'The saved log as JSON string'),
        ]);
    }
}
