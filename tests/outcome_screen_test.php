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
 * The outcome list shown on a flexbook's start and end screens.
 *
 * @package    mod_flexbook
 * @category   test
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 * @covers     \mod_interactivevideo\local\outcome_mapping::screen_rows
 * @covers     \mod_flexbook\util::save_progress
 * @covers     \flexbook_display_options
 */
final class outcome_screen_test extends \advanced_testcase {
    /** @var \stdClass */
    private $course;

    /** @var \stdClass */
    private $instance;

    /** @var \stdClass */
    private $cm;

    /** @var \context_module */
    private $context;

    /** @var \stdClass */
    private $student;

    /** @var \stdClass The outcome grade item record. */
    private $outcomeitem;

    /**
     * A course, a flexbook with an outcome attached, and a student.
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
     * The rows as the screens build them, from the instance id.
     *
     * @return array
     */
    private function rows(): array {
        return outcome_mapping::screen_rows(
            'flexbook',
            (int) $this->cm->instance,
            (int) $this->student->id,
            $this->context
        );
    }

    /**
     * The list is keyed off the instance id even though the items and progress are keyed
     * off the course module id.
     */
    public function test_rows_use_the_instance_id(): void {
        $rows = $this->rows();
        $this->assertCount(1, $rows);
        $this->assertSame('Outcome 1', $rows[0]['name']);
        $this->assertTrue($rows[0]['notrated']);

        \grade_item::fetch(['id' => $this->outcomeitem->id])->update_final_grade($this->student->id, 2, 'test');
        $this->assertSame('Mid', $this->rows()[0]['rating']);
    }

    /**
     * Saving progress rates the learner and hands the fresh rows back for the screens.
     */
    public function test_save_progress_returns_fresh_rows(): void {
        $item = $this->getDataGenerator()->get_plugin_generator('mod_flexbook')->create_item($this->instance, [
            'xp' => 10,
            'completiontracking' => 'complete',
            'advanced' => json_encode(['outcomes' => [
                $this->outcomeitem->outcomeid => ['mode' => 'score', 'thresholds' => [0, 51, 86]],
            ]]),
        ]);

        $record = \mod_flexbook\util::save_progress(
            $this->cm->id,
            $this->student->id,
            json_encode([(string) $item->id]),
            json_encode(['id' => $item->id, 'xp' => 9, 'percent' => 0.9, 'hasDetails' => false]),
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

        $this->assertNotEmpty($record->outcomes);
        $this->assertSame('High', $record->outcomes[0]['rating']);
        $this->assertFalse($record->outcomes[0]['notrated']);
    }

    /**
     * The report's outcome column is filled for every learner.
     *
     * The report resolves the activity from a course module id, but grade items are keyed by
     * instance id, and the course module is only looked up when no course id was passed —
     * which is exactly how the web service calls it.
     */
    public function test_report_data_includes_outcomes(): void {
        $item = $this->getDataGenerator()->get_plugin_generator('mod_flexbook')->create_item($this->instance, [
            'xp' => 10,
            'completiontracking' => 'complete',
            'advanced' => json_encode(['outcomes' => [
                $this->outcomeitem->outcomeid => ['mode' => 'fixed', 'level' => 2],
            ]]),
        ]);
        $other = $this->getDataGenerator()->create_and_enrol($this->course, 'student');

        \mod_flexbook\util::save_progress(
            $this->cm->id,
            $this->student->id,
            json_encode([(string) $item->id]),
            json_encode(['id' => $item->id, 'xp' => 10, 'percent' => 1, 'hasDetails' => false]),
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

        $records = \mod_flexbook\util::get_report_data_by_group(
            $this->cm->id,
            0,
            $this->context->id,
            $this->course->id
        );

        $mine = $records[$this->student->id]->outcomes;
        $this->assertSame(1, $mine['total']);
        $this->assertSame(1, $mine['rated']);
        $this->assertSame(2, $mine['levels']->{$this->outcomeitem->outcomeid});

        $theirs = $records[$other->id]->outcomes;
        $this->assertSame(1, $theirs['total']);
        $this->assertSame(0, $theirs['rated']);
    }

    /**
     * The screen settings round-trip through the activity's display options.
     */
    public function test_display_options_carry_the_screen_settings(): void {
        $options = flexbook_display_options((object) [
            'showoutcomesonstartscreen' => 1,
            'showoutcomesonendscreen' => 0,
        ]);
        $this->assertSame(1, $options['showoutcomesonstartscreen']);
        $this->assertSame(0, $options['showoutcomesonendscreen']);

        $options = flexbook_display_options(new \stdClass());
        $this->assertSame(0, $options['showoutcomesonstartscreen']);
        $this->assertSame(0, $options['showoutcomesonendscreen']);
    }

    /**
     * Nothing is shown with outcomes disabled site-wide.
     */
    public function test_disabled_outcomes_show_nothing(): void {
        set_config('enableoutcomes', 0);
        $this->assertSame([], $this->rows());
    }
}
