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

namespace mod_flexbook\local;

/**
 * Outcome rating adapter for flexbook activities.
 *
 * Unlike interactive video, a flexbook's completion records and items are keyed by the
 * course module id rather than the instance id.
 *
 * @package    mod_flexbook
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class outcome_source extends \mod_interactivevideo\local\outcome_source_base {
    /**
     * The module name.
     *
     * @return string
     */
    public function get_modname(): string {
        return 'flexbook';
    }

    /**
     * The gradable interactions of a flexbook, straight from storage.
     *
     * util::get_items() formats titles and touches $PAGE, neither of which a rating pass
     * needs or can safely do from a task, so the rows are read plain here.
     *
     * @param int $cmid The course module id.
     * @return \stdClass[]
     */
    public static function gradable_items_for_cm(int $cmid): array {
        global $DB;

        $cache = \cache::make('mod_flexbook', 'fb_items');
        $items = $cache->get($cmid);
        if (!$items) {
            $items = array_values($DB->get_records('flexbook_items', ['cmid' => $cmid]));
            $cache->set($cmid, $items);
        }

        $result = [];
        foreach ((array) $items as $item) {
            $item = (object) $item;
            if ((int) ($item->hascompletion ?? 0) === 1) {
                $result[] = $item;
            }
        }
        return $result;
    }

    /**
     * The gradable interactions.
     *
     * @return \stdClass[]
     */
    public function get_gradable_items(): array {
        $cm = $this->get_cm();
        return $cm ? self::gradable_items_for_cm((int) $cm->id) : [];
    }

    /**
     * Every learner's completion record. The cmid column holds the course module id here.
     *
     * @return \moodle_recordset
     */
    public function get_completion_recordset(): \moodle_recordset {
        global $DB;
        $cm = $this->get_cm();
        return $DB->get_recordset(
            'flexbook_completion',
            ['cmid' => $cm ? (int) $cm->id : 0],
            '',
            'id, userid, completeditems, completiondetails'
        );
    }

    /**
     * Drops the cached interactions.
     */
    public function invalidate_items_cache(): void {
        $cm = $this->get_cm();
        if ($cm) {
            \cache::make('mod_flexbook', 'fb_items')->delete($cm->id);
        }
    }
}
