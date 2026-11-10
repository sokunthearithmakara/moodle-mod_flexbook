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
// Moodle 4.1 has the external API classes outside core_external: alias them before external_api is used.
\mod_interactivevideo\local\external_compat::load();

/**
 * The start-screen-only option, and the cover the page redraws when its popup closes.
 *
 * @package    mod_flexbook
 * @category   test
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 * @covers     \flexbook_display_options
 * @covers     \mod_flexbook\external\actions::get_cover
 * @covers     \mod_flexbook\local\cover
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
     * The cover shows the current user's progress and completion.
     */
    public function test_get_cover(): void {
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
            actions::get_cover_returns(),
            actions::get_cover($cm->id, $context->id)
        );
        $this->assertFalse($result['overallcompletion']);
        $this->assertStringContainsString('>' . get_string('start', 'mod_flexbook') . '<', $result['html']);
        // The page's cover: its button opens the popup, rather than being the player's own.
        $this->assertStringContainsString('id="flexbook-cover"', $result['html']);
        $this->assertStringContainsString('data-action="fbopen"', $result['html']);
        $this->assertStringNotContainsString('id="play"', $result['html']);

        $DB->insert_record('flexbook_completion', [
            'cmid' => $cm->id,
            'userid' => $student->id,
            'courseid' => $course->id,
            'timecreated' => time(),
            'timecompleted' => 0,
            'completeditems' => '[]',
            'completionpercentage' => 40,
            'completiondetails' => '[]',
            'lastviewed' => 0,
        ]);

        // Started: the button resumes, and the progress shows.
        $result = external_api::clean_returnvalue(
            actions::get_cover_returns(),
            actions::get_cover($cm->id, $context->id)
        );
        $this->assertStringContainsString('>' . get_string('resume', 'mod_flexbook') . '<', $result['html']);
        $this->assertStringContainsString(get_string('coverprogress', 'mod_flexbook', 40), $result['html']);

        $completion = new \completion_info($course);
        $completion->update_state(get_fast_modinfo($course)->get_cm($cm->id), COMPLETION_COMPLETE, $student->id);

        $result = external_api::clean_returnvalue(
            actions::get_cover_returns(),
            actions::get_cover($cm->id, $context->id)
        );
        $this->assertTrue($result['overallcompletion']);
        // Complete: the button offers to review, and progress is no longer shown.
        $this->assertStringContainsString('>' . get_string('review', 'mod_flexbook') . '<', $result['html']);
        $this->assertStringNotContainsString(get_string('coverprogress', 'mod_flexbook', 40), $result['html']);
    }

    /**
     * A context that is not the course module's is refused.
     */
    public function test_get_cover_wrong_context(): void {
        $this->resetAfterTest();
        $this->setAdminUser();
        $generator = $this->getDataGenerator();
        $course = $generator->create_course();
        $instance = $generator->get_plugin_generator('mod_flexbook')->create_instance(['course' => $course->id]);
        $cm = get_coursemodule_from_instance('flexbook', $instance->id, 0, false, MUST_EXIST);

        $this->expectException(\moodle_exception::class);
        actions::get_cover($cm->id, \context_course::instance($course->id)->id);
    }
}
