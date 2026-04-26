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
 * Uninstall logic for Flexbook
 *
 * @package    mod_flexbook
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/**
 * Custom uninstall function for the module.
 *
 * @return bool True if successful.
 */
function xmldb_flexbook_uninstall() {
    global $CFG;

    require_once($CFG->libdir . '/gradelib.php');
    grade_uninstalled_module('flexbook');

    return true;
}
