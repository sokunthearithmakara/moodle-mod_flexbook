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
 * Test data generator for mod_flexbook.
 *
 * @package    mod_flexbook
 * @category   test
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class mod_flexbook_generator extends testing_module_generator {
    /**
     * Create a flexbook instance with sensible defaults.
     *
     * @param array|stdClass|null $record
     * @param array|null $options
     * @return stdClass
     */
    public function create_instance($record = null, ?array $options = null) {
        $record = (array) $record;

        $record += [
            'endscreentext' => '',
            'grade' => 100,
            'completionpercentage' => 0,
            'displayasstartscreen' => 0,
        ];

        return parent::create_instance($record, (array) $options);
    }

    /**
     * Create an interaction (a flexbook_items row) on an instance.
     *
     * Note the column naming: cmid holds the *course module* id and annotationid the
     * flexbook instance id, the opposite of the completion table in interactive video.
     *
     * @param stdClass $instance The instance returned by create_instance().
     * @param array $record Field overrides, most usefully xp, completiontracking and advanced.
     * @return stdClass The created item.
     */
    public function create_item(stdClass $instance, array $record = []): stdClass {
        global $DB;

        $cm = get_coursemodule_from_instance('flexbook', $instance->id, 0, false, MUST_EXIST);

        $record += [
            'courseid' => $instance->course,
            'cmid' => $cm->id,
            'annotationid' => $instance->id,
            'contextid' => context_module::instance($cm->id)->id,
            'timestamp' => 1.0,
            'title' => 'Test interaction',
            'xp' => 10,
            'displayoptions' => 'popup',
            'type' => 'richtext',
            'hascompletion' => 1,
            'completiontracking' => 'manual',
            'timecreated' => time(),
            'timemodified' => time(),
        ];

        $record['id'] = $DB->insert_record('flexbook_items', (object) $record);

        // Items are memoised per course module, so a directly inserted row would otherwise
        // be invisible to any code that had already read the item list in this request.
        cache::make('mod_flexbook', 'fb_items')->delete($cm->id);

        return (object) $record;
    }
}
