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
 * External functions and service declaration for Flexbook
 *
 * Documentation: {@link https://moodledev.io/docs/apis/subsystems/external/description}
 *
 * @package    mod_flexbook
 * @category   webservice
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

$functions = [
    'mod_flexbook_duplicate' => [
        'classname' => 'mod_flexbook\external\actions',
        'methodname' => 'duplicate',
        'description' => 'Duplicate a flexbook item',
        'type' => 'write',
        'ajax' => true,
    ],
    'mod_flexbook_delete' => [
        'classname' => 'mod_flexbook\external\actions',
        'methodname' => 'delete',
        'description' => 'Delete a flexbook item',
        'type' => 'write',
        'ajax' => true,
    ],
    'mod_flexbook_update_sequence' => [
        'classname' => 'mod_flexbook\external\actions',
        'methodname' => 'update_sequence',
        'description' => 'Update the sequence of a flexbook item',
        'type' => 'write',
        'ajax' => true,
    ],
    'mod_flexbook_quickedit' => [
        'classname' => 'mod_flexbook\external\actions',
        'methodname' => 'quick_edit',
        'description' => 'Quick edit a flexbook item',
        'type' => 'write',
        'ajax' => true,
    ],
    'mod_flexbook_save_progress' => [
        'classname' => 'mod_flexbook\external\actions',
        'methodname' => 'save_progress',
        'description' => 'Save progress of a flexbook completion',
        'type' => 'write',
        'ajax' => true,
    ],
    'mod_flexbook_save_interaction_data' => [
        'classname' => 'mod_flexbook\external\actions',
        'methodname' => 'save_interaction_data',
        'description' => 'Save lightweight interaction data (timespent, views, lastviewed)',
        'type' => 'write',
        'ajax' => true,
    ],
    'mod_flexbook_get_report_data' => [
        'classname' => 'mod_flexbook\external\actions',
        'methodname' => 'get_report_data',
        'description' => 'Get report data for a flexbook instance',
        'type' => 'read',
        'ajax' => true,
    ],
    'mod_flexbook_delete_progress' => [
        'classname' => 'mod_flexbook\external\actions',
        'methodname' => 'delete_progress',
        'description' => 'Delete flexbook completion records',
        'type' => 'write',
        'ajax' => true,
    ],
    'mod_flexbook_delete_completion_data' => [
        'classname' => 'mod_flexbook\external\actions',
        'methodname' => 'delete_completion_data',
        'description' => 'Delete completion data for a specific item',
        'type' => 'write',
        'ajax' => true,
    ],
    'mod_flexbook_get_logs' => [
        'classname' => 'mod_flexbook\external\actions',
        'methodname' => 'get_logs',
        'description' => 'Get logs for multiple users',
        'type' => 'read',
        'ajax' => true,
    ],
    'mod_flexbook_save_log' => [
        'classname' => 'mod_flexbook\external\actions',
        'methodname' => 'save_log',
        'description' => 'Save interaction log',
        'type' => 'write',
        'ajax' => true,
    ],
    'mod_flexbook_delete_own_completion_data' => [
        'classname' => 'mod_flexbook\external\actions',
        'methodname' => 'delete_own_completion_data',
        'description' => 'Delete own completion data for a specific item',
        'type' => 'write',
        'ajax' => true,
    ],
];
