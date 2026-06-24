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
 * Restore step for Flexbook course-level settings and interaction defaults.
 *
 * @package    mod_flexbook
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class restore_flexbook_course_settings extends restore_activity_structure_step {
    /**
     * Structure step to restore Flexbook course settings and defaults.
     *
     * @return array
     */
    protected function define_structure() {
        global $DB;
        $paths = [];
        $restoreid = $this->get_restoreid();
        $type = $DB->get_field('backup_controllers', 'type', ['backupid' => $restoreid]);
        if ($type !== 'course') {
            return $this->prepare_activity_structure($paths);
        }

        $paths[] = new restore_path_element(
            'flexbooksetting',
            '/activity/flexbook_container/flexbooksetting'
        );

        $paths[] = new restore_path_element(
            'defaultinfos',
            '/activity/flexbook_container/defaultinfos/defaultinfo'
        );

        return $this->prepare_activity_structure($paths);
    }

    /**
     * Process a Flexbook course settings restore.
     *
     * @param array $data
     * @return void
     */
    protected function process_flexbooksetting($data) {
        static $process = false;

        if (empty($data) || $process) {
            return;
        }
        $process = true;

        if ($data['courseid'] == $this->get_courseid()) {
            return;
        }

        if ($this->get_mappingid('flexbooksetting', $data['courseid'])) {
            return;
        }

        global $DB;
        if ($DB->record_exists('flexbook_settings', ['courseid' => $this->get_courseid()])) {
            return;
        }

        $data = (object) $data;
        $oldid = $data->courseid;
        $data->courseid = $this->get_courseid();
        $data->timecreated = time();
        $data->timemodified = time();
        $DB->insert_record('flexbook_settings', $data);
        $this->set_mapping('flexbooksetting', $oldid, $data->courseid);
    }

    /**
     * Process interaction defaults.
     *
     * @param array $data
     * @return void
     */
    protected function process_defaultinfos($data) {
        static $processedtypes = [];

        if (empty($data)) {
            return;
        }

        if ($data['courseid'] == $this->get_courseid()) {
            return;
        }

        if (in_array($data['type'], $processedtypes)) {
            return;
        }
        $processedtypes[] = $data['type'];

        global $DB;
        if (
            $DB->record_exists('flexbook_defaults', [
                'courseid' => $this->get_courseid(),
                'type' => $data['type'],
            ])
        ) {
            return;
        }

        $data = (object) $data;
        $data->courseid = $this->get_courseid();
        $data->timecreated = time();
        $data->timemodified = time();
        $DB->insert_record('flexbook_defaults', $data);
    }
}
