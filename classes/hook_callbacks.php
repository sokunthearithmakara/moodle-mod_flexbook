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

/**
 * Class hook_callbacks
 *
 * @package    mod_flexbook
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class hook_callbacks {
    /**
     * Load AMD for Flexbook admin settings pages.
     *
     * @param \core\hook\output\before_http_headers|null $hook Unused; present for hook registration.
     */
    public static function init_plugin_admin_settings(?\core\hook\output\before_http_headers $hook = null): void {
        global $PAGE;

        $allowedpagetypes = [
            'admin-setting-modfbfolder',
            'admin-setting-modsettingflexbook',
            'admin-setting-upgradesettings',
        ];
        if (!in_array($PAGE->pagetype, $allowedpagetypes, true)) {
            return;
        }

        $PAGE->requires->js_call_amd('mod_flexbook/settings', 'init');
    }

    /**
     * Add messaging widgets after the main region content.
     *
     * @param \core\hook\output\after_standard_main_region_html_generation $hook The hook instance.
     * @return void
     */
    public static function launch_player_modal(\core\hook\output\after_standard_main_region_html_generation $hook): void {
        global $PAGE, $CFG;
        if (strpos($PAGE->bodyclasses, 'path-course-view') === false) {
            return;
        }

        require_once($CFG->dirroot . '/mod/flexbook/lib.php');

        $hook->add_html(\mod_flexbook\util::render_moodle_version());
    }
}
