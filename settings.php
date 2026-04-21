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
 * Flexbook settings page
 *
 * @package    mod_flexbook
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die;
require_once($CFG->dirroot . '/user/profile/lib.php');

// Basic fields available in user table.
$fields = [
    'username'    => new lang_string('username'),
    'idnumber'    => new lang_string('idnumber'),
    'email'       => new lang_string('email'),
    'phone1'      => new lang_string('phone1'),
    'phone2'      => new lang_string('phone2'),
    'department'  => new lang_string('department'),
    'institution' => new lang_string('institution'),
    'city'        => new lang_string('city'),
    'country'     => new lang_string('country'),
];

// Custom profile fields.
$profilefields = profile_get_custom_fields();
foreach ($profilefields as $field) {
    $fields['profile_field_' . $field->shortname] = format_string(
        $field->name,
        true
    ) . ' *';
}

$settings = null; // Must first tell Moodle not to add the default node.

$modfolder = new admin_category(
    'modfbfolder',
    new lang_string('pluginname', 'mod_flexbook'),
    $module->is_enabled() === false
);
$ADMIN->add('modsettings', $modfolder);

$gsettings = new admin_settingpage('modsettingflexbook', get_string('generalsettings', 'mod_interactivevideo'));
$contenttypes = [];
$customarray = [];
$customs = get_plugins_with_function('fbplugin');
foreach ($customs as $custom) {
    foreach ($custom as $function) {
        $function = str_replace('_fbplugin', '', $function);
        $version = get_config($function);
        if (!empty($version->version)) {
            $version = $version->version;
            $newversion = $version;
            $updateavailable = false;
            $interaction = '<span class="ivname">' . get_string('pluginname', $function)
                . '<span class="badge alert-primary mx-1">' . get_string('external', 'mod_interactivevideo')
                . '</span></span><small class="text-muted">' . $version . '</small>'
                . ($updateavailable ? ($updatelink
                    ? '<a href="' . $updatelink . '" class="badge badge-success mx-1" target="_blank">'
                    . get_string('updateavailable', 'mod_interactivevideo') . '</a>' : '<span class="badge iv-badge-warning mx-1">'
                    . get_string('updateavailable', 'mod_interactivevideo') . '</span>') : '');
        } else {
            $interaction = '<span class="ivname">' . get_string('pluginname', $function)
                . '<span class="badge alert-primary mx-1">' . get_string('external', 'mod_interactivevideo')
                . '</span></span>';
        }
        $contenttypes[$function] = $interaction;
        $customarray[] = [
            'component' => $function,
            'version' => $version,
            'newversion' => $newversion,
            'updateavailable' => $updateavailable,
        ];
    }
}

// Sort the content types by name a-z.
asort($contenttypes);

$gsettings->add(new admin_setting_configmulticheckbox(
    'mod_flexbook/enablecontenttypes',
    get_string('enablecontenttypes', 'mod_interactivevideo'),
    get_string('enablecontenttypes_desc', 'mod_interactivevideo'),
    $contenttypes,
    $contenttypes,
));

$ADMIN->add('modfbfolder', $gsettings);
