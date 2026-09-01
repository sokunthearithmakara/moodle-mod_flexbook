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

use mod_interactivevideo\local\contenttype_activation;

defined('MOODLE_INTERNAL') || die();

global $CFG;
require_once($CFG->dirroot . '/mod/flexbook/lib.php');
require_once($CFG->dirroot . '/mod/interactivevideo/locallib.php');

/**
 * The content fragment only builds classes a usable content type declares.
 *
 * The class name arrives from the browser and core_get_fragment performs only validate_context(),
 * so without an allow list anyone able to reach the context could instantiate any autoloadable
 * class in the tree, and a deactivated paid content type could be driven directly.
 *
 * @package    mod_flexbook
 * @category   test
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 * @covers     \flexbook_output_fragment_getcontent
 */
final class fragment_allowlist_test extends \advanced_testcase {
    /**
     * Build the fragment argument for a given class name.
     *
     * @param string $class
     * @return array
     */
    private function args_for(string $class): array {
        return [
            'prop' => json_encode(['class' => $class]),
            'id' => 1,
            'contextid' => \context_system::instance()->id,
        ];
    }

    /**
     * A refused fragment echoes its argument back untouched.
     *
     * @param array $args
     */
    private function assert_refused(array $args): void {
        $this->assertSame(
            json_encode($args),
            flexbook_output_fragment_getcontent($args),
            'A class outside the allow list must not be instantiated'
        );
    }

    /**
     * An arbitrary autoloadable class cannot be built through the fragment.
     */
    public function test_arbitrary_class_is_refused(): void {
        $this->resetAfterTest();

        $this->assert_refused($this->args_for('core_user'));
        $this->assert_refused($this->args_for('moodle_url'));
    }

    /**
     * A class that does not exist at all is refused rather than fatal.
     */
    public function test_unknown_class_is_refused(): void {
        $this->resetAfterTest();

        $this->assert_refused($this->args_for('mod_flexbook\\definitely_not_a_class'));
    }

    /**
     * A malformed payload is refused rather than fatal.
     */
    public function test_malformed_payload_is_refused(): void {
        $this->resetAfterTest();

        $args = ['id' => 1];
        $this->assertSame(json_encode($args), flexbook_output_fragment_getcontent($args));

        $args = ['prop' => 'not json at all'];
        $this->assertSame(json_encode($args), flexbook_output_fragment_getcontent($args));
    }

    /**
     * A content type this site may not use cannot be driven through the fragment.
     *
     * This is the licence half: the class is perfectly real and is declared by an installed
     * content type, so only the activation check keeps it out.
     */
    public function test_deactivated_content_type_class_is_refused(): void {
        $this->resetAfterTest();

        $types = \mod_flexbook\util::get_all_activitytypes_unfiltered();
        $target = null;
        foreach ($types as $properties) {
            $component = $properties['component'] ?? ($properties['stringcomponent'] ?? '');
            if ($component !== '' && !empty($properties['class']) && class_exists($properties['class'])) {
                $target = $properties;
                break;
            }
        }

        if ($target === null) {
            $this->markTestSkipped('No flexbook content type is installed on this site');
        }

        $component = $target['component'] ?? $target['stringcomponent'];

        // While it is usable, its class is on the allow list.
        $this->assertContains(
            $target['class'],
            array_column(\mod_flexbook\util::get_usable_activitytypes(), 'class'),
            'Precondition: the content type must start out usable'
        );

        // Mark it paid without activating it, exactly as registering a purchase email would.
        $known = contenttype_activation::get_paid_components();
        $known[] = $component;
        set_config(
            contenttype_activation::CONFIG_PAIDCOMPONENTS,
            implode(',', array_unique($known)),
            'mod_interactivevideo'
        );
        $this->assertFalse(contenttype_activation::is_usable($component));

        $this->assertNotContains(
            $target['class'],
            array_column(\mod_flexbook\util::get_usable_activitytypes(), 'class'),
            'A deactivated content type must drop off the allow list'
        );
        $this->assert_refused($this->args_for($target['class']));
    }
}
