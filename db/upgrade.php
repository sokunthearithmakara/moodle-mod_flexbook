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
 * Upgrade steps for Flexbook
 *
 * Documentation: {@link https://moodledev.io/docs/guides/upgrade}
 *
 * @package    mod_flexbook
 * @category   upgrade
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/**
 * Execute the plugin upgrade steps from the given old version.
 *
 * @param int $oldversion The version we are upgrading from.
 * @return bool True if successful.
 */
function xmldb_flexbook_upgrade($oldversion) {
    global $DB, $OUTPUT;
    $dbman = $DB->get_manager();

    if ($oldversion < 2026042000) {
        // Define field details to be added to flexbook_completion.
        $table = new xmldb_table('flexbook_completion');
        $field = new xmldb_field('details', XMLDB_TYPE_TEXT, null, null, null, null, null, 'lastviewed');

        // Conditionally launch add field details.
        if (!$dbman->field_exists($table, $field)) {
            $dbman->add_field($table, $field);
        }

        // Flexbook savepoint reached.
        upgrade_mod_savepoint(true, 2026042000, 'flexbook');
    }

    if ($oldversion < 2026062404) {
        upgrade_mod_savepoint(true, 2026062404, 'flexbook');
    }

    if ($oldversion < 2026062405) {
        // Content types catalog uses mod_interactivevideo_get_plugins_catalog with target param.
        upgrade_mod_savepoint(true, 2026062405, 'flexbook');
    }

    if ($oldversion < 2026090201) {
        // Scale was offered in modgrade but never created a grade item; normalise legacy values.
        $DB->execute('UPDATE {flexbook} SET grade = 0 WHERE grade < 0');

        upgrade_mod_savepoint(true, 2026090201, 'flexbook');
    }

    // Enforcement is otherwise silent: an unactivated content type simply stops appearing.
    // Say so while the administrator is looking at the upgrade output.
    flexbook_report_unactivated_contenttypes($OUTPUT);

    return true;
}

/**
 * Print a warning naming content types that are installed but cannot be used.
 *
 * Shared by install and upgrade. Prints nothing when every installed paid content type is
 * activated, so it does not become noise on a healthy site.
 *
 * @param \renderer_base $output The page renderer.
 */
function flexbook_report_unactivated_contenttypes($output) {
    $message = \mod_interactivevideo\local\activation_notice::message(
        \mod_interactivevideo\local\activation_notice::MODULE_FLEXBOOK
    );

    if ($message === null) {
        return;
    }

    echo $output->notification(
        $message,
        \core\output\notification::NOTIFY_WARNING,
        false,
        get_string('activationnoticetitle', 'mod_interactivevideo'),
        'i/warning'
    );
}
