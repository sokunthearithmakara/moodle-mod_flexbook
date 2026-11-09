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

use core_external\external_api;
use mod_flexbook\external\actions;

defined('MOODLE_INTERNAL') || die();

global $CFG;
require_once($CFG->dirroot . '/mod/flexbook/lib.php');
require_once($CFG->libdir . '/completionlib.php');

/**
 * The start-screen-only option, and the completion the popup reads back when it closes.
 *
 * @package    mod_flexbook
 * @category   test
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 * @covers     \flexbook_display_options
 * @covers     \mod_flexbook\external\actions::get_cm_completion
 */
final class startscreenonly_test extends \advanced_testcase {
    /**
     * The option is off unless set, and is kept when set.
     */
    public function test_display_option(): void {
        $this->resetAfterTest();

        $this->assertSame(0, flexbook_display_options(new \stdClass())['startscreenonly']);
        $this->assertSame(1, flexbook_display_options((object) ['startscreenonly' => 1])['startscreenonly']);

        // A site default turns it on for new activities.
        set_config('defaultappearance', 'startscreenonly', 'mod_flexbook');
        $this->assertSame(1, flexbook_display_options(new \stdClass())['startscreenonly']);
    }

    /**
     * The completion endpoint reports progress and completion for the current user.
     */
    public function test_get_cm_completion(): void {
        global $DB;
        $this->resetAfterTest();
        $generator = $this->getDataGenerator();
        $course = $generator->create_course(['enablecompletion' => 1]);
        $instance = $generator->get_plugin_generator('mod_flexbook')->create_instance([
            'course' => $course->id,
            'completion' => COMPLETION_TRACKING_MANUAL,
        ]);
        $cm = get_coursemodule_from_instance('flexbook', $instance->id, 0, false, MUST_EXIST);
        $context = \context_module::instance($cm->id);
        $student = $generator->create_and_enrol($course, 'student');
        $this->setUser($student);

        $result = external_api::clean_returnvalue(
            actions::get_cm_completion_returns(),
            actions::get_cm_completion($cm->id, $context->id)
        );
        $this->assertFalse($result['hasprogress']);
        $this->assertFalse($result['overallcompletion']);

        $DB->insert_record('flexbook_completion', [
            'cmid' => $cm->id,
            'userid' => $student->id,
            'courseid' => $course->id,
            'timecreated' => time(),
            'timecompleted' => 0,
            'completeditems' => '[]',
            'completionpercentage' => 0,
            'completiondetails' => '[]',
        ]);
        $completion = new \completion_info($course);
        $completion->update_state(get_fast_modinfo($course)->get_cm($cm->id), COMPLETION_COMPLETE, $student->id);

        $result = external_api::clean_returnvalue(
            actions::get_cm_completion_returns(),
            actions::get_cm_completion($cm->id, $context->id)
        );
        $this->assertTrue($result['hasprogress']);
        $this->assertTrue($result['overallcompletion']);
    }

    /**
     * A context that is not the course module's is refused.
     */
    public function test_get_cm_completion_wrong_context(): void {
        $this->resetAfterTest();
        $this->setAdminUser();
        $generator = $this->getDataGenerator();
        $course = $generator->create_course();
        $instance = $generator->get_plugin_generator('mod_flexbook')->create_instance(['course' => $course->id]);
        $cm = get_coursemodule_from_instance('flexbook', $instance->id, 0, false, MUST_EXIST);

        $this->expectException(\moodle_exception::class);
        actions::get_cm_completion($cm->id, \context_course::instance($course->id)->id);
    }
}
