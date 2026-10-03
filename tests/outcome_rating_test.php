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

use mod_interactivevideo\local\outcome_mapping;

defined('MOODLE_INTERNAL') || die();

global $CFG;
require_once($CFG->dirroot . '/mod/flexbook/lib.php');
require_once($CFG->dirroot . '/mod/interactivevideo/locallib.php');
require_once($CFG->libdir . '/gradelib.php');

/**
 * Outcome ratings follow a learner's flexbook progress.
 *
 * @package    mod_flexbook
 * @category   test
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 * @covers     \mod_flexbook\local\outcome_source
 * @covers     \mod_flexbook\util::save_progress
 * @covers     \mod_flexbook\util::override_completion_xp
 * @covers     \mod_flexbook\util::delete_completion_data
 * @covers     \mod_flexbook\util::delete_progress_by_id
 */
final class outcome_rating_test extends \advanced_testcase {
    /** @var array A three level threshold mapping. */
    private const SCORE = ['mode' => 'score', 'thresholds' => [0, 51, 86]];

    /** @var \stdClass */
    private $course;

    /** @var \stdClass */
    private $instance;

    /** @var \stdClass */
    private $cm;

    /** @var \context_module */
    private $context;

    /** @var int */
    private $outcomeid;

    /** @var \stdClass The outcome grade item record. */
    private $outcomeitem;

    /** @var \stdClass */
    private $student;

    /**
     * A course, a flexbook with one outcome attached, and a student.
     */
    protected function setUp(): void {
        parent::setUp();
        $this->resetAfterTest();
        $this->setAdminUser();
        set_config('enableoutcomes', 1);

        $generator = $this->getDataGenerator();
        $this->course = $generator->create_course();
        $this->instance = $generator->get_plugin_generator('mod_flexbook')->create_instance(['course' => $this->course->id]);
        $this->cm = get_coursemodule_from_instance('flexbook', $this->instance->id, 0, false, MUST_EXIST);
        $this->context = \context_module::instance($this->cm->id);
        $this->student = $generator->create_and_enrol($this->course, 'student');

        $scale = $generator->create_scale(['scale' => 'Low,Mid,High', 'courseid' => $this->course->id]);
        $outcome = $generator->create_grade_outcome([
            'courseid' => $this->course->id,
            'shortname' => 'o1',
            'fullname' => 'Outcome 1',
            'scaleid' => $scale->id,
        ]);
        $this->outcomeid = (int) $outcome->id;
        $this->outcomeitem = $generator->create_grade_item([
            'courseid' => $this->course->id,
            'itemtype' => 'mod',
            'itemmodule' => 'flexbook',
            'iteminstance' => $this->instance->id,
            'itemnumber' => 1000,
            'itemname' => $outcome->fullname,
            'outcomeid' => $outcome->id,
        ]);
    }

    /**
     * Create an interaction linked to the outcome.
     *
     * @param array|null $entry The mapping entry, null for none.
     * @param array $overrides Further item fields.
     * @return \stdClass
     */
    private function create_item(?array $entry, array $overrides = []): \stdClass {
        $advanced = ['autolaunch' => 1];
        if ($entry !== null) {
            $advanced['outcomes'] = [$this->outcomeid => $entry];
        }
        return $this->getDataGenerator()->get_plugin_generator('mod_flexbook')->create_item(
            $this->instance,
            $overrides + ['xp' => 10, 'completiontracking' => 'complete', 'advanced' => json_encode($advanced)]
        );
    }

    /**
     * Save progress for the student on one interaction, as the reader does after an attempt.
     *
     * @param \stdClass $item
     * @param array $detail Detail fields.
     * @param array $alsocompleted Other interaction ids already completed.
     * @return \stdClass The completion record.
     */
    private function complete(\stdClass $item, array $detail = [], array $alsocompleted = []): \stdClass {
        $completed = array_map('strval', array_merge($alsocompleted, [$item->id]));
        $detail += ['id' => $item->id, 'xp' => $item->xp, 'percent' => 1, 'hasDetails' => false];

        return \mod_flexbook\util::save_progress(
            $this->cm->id,
            $this->student->id,
            json_encode($completed),
            json_encode($detail),
            true,
            'contentbank',
            '',
            0,
            0,
            0,
            0,
            0,
            false,
            $this->course->id
        );
    }

    /**
     * The student's stored rating, null for "no outcome".
     *
     * @return int|null
     */
    private function rating(): ?int {
        global $DB;
        $final = $DB->get_field('grade_grades', 'finalgrade', [
            'itemid' => $this->outcomeitem->id, 'userid' => $this->student->id,
        ]);
        return ($final === false || $final === null) ? null : (int) $final;
    }

    /**
     * Ratings are computed from the stored record, keyed by course module id.
     */
    public function test_score_mode_rates_on_save(): void {
        $item = $this->create_item(self::SCORE);

        $this->complete($item, ['xp' => 6, 'percent' => 0.6]);
        $this->assertSame(2, $this->rating());

        $this->complete($item, ['xp' => 10, 'percent' => 1]);
        $this->assertSame(3, $this->rating());

        $this->complete($item, ['xp' => 3, 'percent' => 0.3]);
        $this->assertSame(1, $this->rating());
    }

    /**
     * Fixed levels and scored interactions average by XP.
     */
    public function test_fixed_and_score_mix(): void {
        $viewed = $this->create_item(['mode' => 'fixed', 'level' => 1], ['completiontracking' => 'view', 'xp' => 10]);
        $scored = $this->create_item(self::SCORE, ['xp' => 30]);

        $this->complete($viewed);
        $this->assertSame(1, $this->rating());

        // Weighted: (10 * 1 + 30 * 3) / 40 = 2.5 rounds up.
        $this->complete($scored, ['xp' => 30, 'percent' => 1], [$viewed->id]);
        $this->assertSame(3, $this->rating());
    }

    /**
     * A teacher's XP override re-rates.
     */
    public function test_override_rerates(): void {
        $item = $this->create_item(self::SCORE);
        $record = $this->complete($item, ['xp' => 9, 'percent' => 0.9]);
        $this->assertSame(3, $this->rating());

        \mod_flexbook\util::override_completion_xp(
            $record->id,
            $item->id,
            $this->student->id,
            $this->context->id,
            3,
            $this->course->id
        );
        $this->assertSame(1, $this->rating());
    }

    /**
     * Deleting the attempt, or the whole record, leaves no outcome.
     */
    public function test_deletes_clear(): void {
        $item = $this->create_item(self::SCORE);
        $record = $this->complete($item, ['xp' => 9, 'percent' => 0.9]);
        $this->assertSame(3, $this->rating());

        \mod_flexbook\util::delete_completion_data($record->id, $item->id, $this->student->id, $this->context->id);
        $this->assertNull($this->rating());

        $record = $this->complete($item, ['xp' => 9, 'percent' => 0.9]);
        $this->assertSame(3, $this->rating());
        \mod_flexbook\util::delete_progress_by_id($this->context->id, $record->id, $this->course->id, $this->cm->id);
        $this->assertNull($this->rating());
    }

    /**
     * The backfill pass finds a flexbook's items and records through the course module id.
     */
    public function test_rate_all(): void {
        global $DB;
        $item = $this->create_item(null);
        $this->complete($item, ['xp' => 9, 'percent' => 0.9]);
        $this->assertNull($this->rating());

        $DB->set_field('flexbook_items', 'advanced', json_encode([
            'outcomes' => [$this->outcomeid => self::SCORE],
        ]), ['id' => $item->id]);
        outcome_mapping::queue_backfill('flexbook', $this->instance->id);
        $this->runAdhocTasks('\mod_interactivevideo\task\rate_outcomes');

        $this->assertSame(3, $this->rating());
    }

    /**
     * Course reset with completion clears the ratings.
     */
    public function test_reset_userdata_clears_ratings(): void {
        $item = $this->create_item(self::SCORE);
        $this->complete($item, ['xp' => 9, 'percent' => 0.9]);
        $this->assertSame(3, $this->rating());

        flexbook_reset_userdata((object) [
            'courseid' => $this->course->id,
            'reset_completion' => 1,
            'reset_gradebook_grades' => 0,
        ]);
        $this->assertNull($this->rating());
    }

    /**
     * Nothing is written with outcomes disabled.
     */
    public function test_disabled_outcomes_write_nothing(): void {
        set_config('enableoutcomes', 0);
        $item = $this->create_item(self::SCORE);

        $this->complete($item, ['xp' => 9, 'percent' => 0.9]);
        $this->assertNull($this->rating());
    }
}
