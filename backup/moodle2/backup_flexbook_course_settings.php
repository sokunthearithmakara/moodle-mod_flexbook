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
 * Backup step for Flexbook course-level settings and interaction defaults.
 *
 * @package    mod_flexbook
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class backup_flexbook_course_settings extends backup_activity_structure_step {
    /**
     * Backup structure
     */
    protected function define_structure() {
        global $DB;

        // Wrapper root element (does not map to a table).
        $container = new backup_nested_element('flexbook_container');

        // Course settings element.
        $flexbooksetting = new backup_nested_element('flexbooksetting', ['id'], [
            'courseid',
            'endscreentext',
            'displayasstartscreen',
            'completionpercentage',
            'displayoptions',
            'extendedcompletion',
            'completion',
            'defaults',
        ]);

        // Interaction defaults elements.
        $defaultinfos = new backup_nested_element('defaultinfos');

        $columns = array_keys($DB->get_columns('flexbook_defaults'));
        $columns = array_diff($columns, ['id']);

        $default = new backup_nested_element('defaultinfo', ['id'], $columns);

        // Build the hierarchy under the container.
        $container->add_child($flexbooksetting);
        $container->add_child($defaultinfos);
        $defaultinfos->add_child($default);

        // Define sources.
        $flexbooksetting->set_source_table('flexbook_settings', [
            'courseid' => backup::VAR_COURSEID,
        ]);

        $default->set_source_table('flexbook_defaults', [
            'courseid' => backup::VAR_COURSEID,
        ]);

        return $this->prepare_activity_structure($container);
    }
}
