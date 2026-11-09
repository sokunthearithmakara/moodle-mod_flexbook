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

use cm_info;
use context_module;

/**
 * The cover a start-screen-only flexbook shows on its page: what the book is, where the learner stands, and the
 * button that opens it in the popup.
 *
 * @package    mod_flexbook
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class cover {
    /**
     * The cover's template context.
     *
     * @param cm_info $cm
     * @param int $userid
     * @return array
     */
    public static function export(cm_info $cm, int $userid): array {
        global $CFG, $DB;
        require_once($CFG->libdir . '/completionlib.php');
        require_once($CFG->libdir . '/gradelib.php');

        $context = context_module::instance($cm->id);
        $flexbook = $DB->get_record('flexbook', ['id' => $cm->instance], 'id, intro, introformat', MUST_EXIST);

        // A learner has a progress record from their first open; they have started once there is anything in it.
        $progress = $DB->get_record(
            'flexbook_completion',
            ['cmid' => $cm->id, 'userid' => $userid],
            'id, completionpercentage, timecompleted, lastviewed',
            IGNORE_MULTIPLE
        );
        $started = $progress && ($progress->timecompleted || $progress->lastviewed
            || (float) $progress->completionpercentage);
        $percent = $started ? (int) round((float) $progress->completionpercentage) : 0;

        $details = \core_completion\cm_completion_details::get_instance($cm, $userid);
        $complete = ($started && $progress->timecompleted)
            || ($details->has_completion() && $details->get_overall_completion() != COMPLETION_INCOMPLETE);
        $button = $complete ? 'review' : ($started ? 'resume' : 'start');

        $grademax = self::grade_max($cm);
        $expect = [];
        if ($due = self::due_date($cm, $userid)) {
            $expect[] = [
                'text' => get_string('coverdue', 'mod_flexbook', userdate($due, get_string('strftimedatetimeshort', 'langconfig'))),
                'isdue' => true,
            ];
        }
        if ($grademax) {
            $expect[] = [
                'text' => get_string('coverpoints', 'mod_flexbook', format_float($grademax, -1)),
                'isgrade' => true,
            ];
        }
        // Every completion condition, worded as the activity header words them; the ones met are marked.
        $conditions = [];
        if ($details->has_completion() && $details->is_automatic()) {
            foreach ($details->get_details() as $condition) {
                $conditions[] = [
                    'text' => $condition->description,
                    'isdone' => in_array($condition->status, [COMPLETION_COMPLETE, COMPLETION_COMPLETE_PASS], true),
                ];
            }
        } else if ($details->has_completion()) {
            $conditions[] = ['text' => get_string('completion_manual:markdone', 'core_course'), 'isdone' => $complete];
        }
        if ($conditions) {
            $last = array_key_last($conditions);
            foreach ($conditions as $key => $condition) {
                $conditions[$key]['islast'] = $key === $last;
            }
            $expect[] = ['iscompletion' => true, 'conditions' => $conditions];
        }

        // The outcomes the book rates, and the learner's standing on each.
        $outcomes = \mod_interactivevideo\local\outcome_mapping::screen_rows(
            'flexbook',
            (int) $cm->instance,
            $userid,
            $context
        );

        $intro = format_module_intro('flexbook', $flexbook, $cm->id);
        return [
            'cmid' => $cm->id,
            'courseid' => $cm->course,
            'contextid' => $context->id,
            'title' => $cm->get_formatted_name(),
            'poster' => $cm->customdata['posterimage'] ?? null,
            'intro' => trim(strip_tags($intro, '<img><iframe><video><audio>')) !== '' ? $intro : null,
            'button' => get_string($button, 'mod_flexbook'),
            'progress' => ($started && !$complete && $percent > 0)
                ? get_string('coverprogress', 'mod_flexbook', $percent) : null,
            'expect' => $expect,
            'hasexpect' => !empty($expect),
            'outcomes' => $outcomes,
            'hasoutcomes' => !empty($outcomes),
            'overallcompletion' => $details->has_completion()
                && $details->get_overall_completion() != COMPLETION_INCOMPLETE,
        ];
    }

    /**
     * The activity's due date: a date of its own named due, else the date completion is expected.
     *
     * @param cm_info $cm
     * @param int $userid
     * @return int|null
     */
    protected static function due_date(cm_info $cm, int $userid): ?int {
        foreach (\core\activity_dates::get_dates_for_module($cm, $userid) as $date) {
            if (str_contains((string) ($date['dataid'] ?? ''), 'due')) {
                return (int) $date['timestamp'];
            }
        }
        return $cm->completionexpected ? (int) $cm->completionexpected : null;
    }

    /**
     * The maximum grade of the book's grade item, when it is graded.
     *
     * @param cm_info $cm
     * @return float|null
     */
    protected static function grade_max(cm_info $cm): ?float {
        $item = \grade_item::fetch([
            'courseid' => $cm->course,
            'itemtype' => 'mod',
            'itemmodule' => 'flexbook',
            'iteminstance' => $cm->instance,
            'itemnumber' => 0,
        ]);
        if (!$item || $item->gradetype == GRADE_TYPE_NONE || (float) $item->grademax <= 0) {
            return null;
        }
        return (float) $item->grademax;
    }
}
