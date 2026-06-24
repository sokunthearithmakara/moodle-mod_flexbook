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
 * Multipart draft upload endpoint for Flexbook DnD.
 *
 * @package    mod_flexbook
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define('AJAX_SCRIPT', true);

require_once(__DIR__ . '/../../config.php');

use mod_flexbook\draft_upload;

/**
 * Send a JSON response and stop.
 *
 * @param array $payload
 * @param int $status
 */
function mod_flexbook_draftupload_send(array $payload, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload);
    exit;
}

try {
    require_sesskey();

        $contextid = required_param('contextid', PARAM_INT);
        $draftitemid = optional_param('draftitemid', 0, PARAM_INT);
        $filepath = optional_param('filepath', '/', PARAM_PATH);

        $context = \context::instance_by_id($contextid, MUST_EXIST);
    $cm = get_coursemodule_from_id('flexbook', $context->instanceid, 0, false, MUST_EXIST);
    require_login($cm->course, false, $cm);

    \core_php_time_limit::raise();
    \core\session\manager::write_close();

    $result = draft_upload::store_uploaded_file($contextid, $draftitemid, $filepath);
    mod_flexbook_draftupload_send($result);
} catch (\Throwable $exception) {
    mod_flexbook_draftupload_send(['error' => $exception->getMessage()], 400);
}
