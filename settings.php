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
$customs = get_plugins_with_function('fbplugin');
foreach ($customs as $custom) {
    foreach ($custom as $function) {
        $function = str_replace('_fbplugin', '', $function);
        $version = get_config($function);
        if (!empty($version->version)) {
            $version = $version->version;
            $interaction = '<span class="ivname">' . get_string('pluginname', $function)
                . '<span class="badge alert-primary mx-1">' . get_string('external', 'mod_interactivevideo')
                . '</span></span><small class="text-muted">' . $version . '</small>';
        } else {
            $interaction = '<span class="ivname">' . get_string('pluginname', $function)
                . '<span class="badge alert-primary mx-1">' . get_string('external', 'mod_interactivevideo')
                . '</span></span>';
        }
        $contenttypes[$function] = $interaction;
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

// Default appearance settings page.
$asettings = new admin_settingpage('mod_flexbook_appearance', get_string('appearancesettings', 'mod_flexbook'));

// Default force theme.
$themeobjects = get_list_of_themes();
$themes = [];
$themes[''] = get_string('forceno');
foreach ($themeobjects as $key => $theme) {
    if (empty($theme->hidefromselector)) {
        $themes[$key] = get_string('pluginname', 'theme_' . $theme->name);
    }
}
$asettings->add(new admin_setting_configselect(
    'mod_flexbook/defaulttheme',
    get_string('defaulttheme', 'mod_interactivevideo'),
    get_string('defaulttheme_desc', 'mod_interactivevideo'),
    '',
    $themes,
));

$asettings->add(new admin_setting_configcheckbox(
    'mod_flexbook/allowcustomtheme',
    get_string('allowcustomtheme', 'mod_interactivevideo'),
    get_string('allowcustomtheme_desc', 'mod_interactivevideo'),
    1,
));

$asettings->add(new admin_setting_configmulticheckbox(
    'mod_flexbook/defaultappearance',
    get_string('defaultappearance', 'mod_interactivevideo'),
    get_string('defaultappearance_desc', 'mod_interactivevideo'),
    [
        'distractionfreemode' => 1,
        'darkmode' => 1,
        'showdescriptiononheader' => 0,
        'courseindex' => 0,
        'controlbar' => 1,
        'interactionbar' => 1,
        'chaptertoggle' => 1,
        'share' => 1,
        'fullscreen' => 1,
        'xpcounter' => 1,
        'interactioncounter' => 1,
        'interactionnavigation' => 1,
        'duolingotheme' => 0,
    ],
    [
        'distractionfreemode' => get_string('distractionfreemode', 'mod_flexbook'),
        'darkmode' => get_string('darkmode', 'mod_flexbook'),
        'showdescriptiononheader' => get_string('displaydescriptiononactivityheader', 'mod_flexbook'),
        'courseindex' => get_string('courseindex', 'mod_flexbook'),
        'controlbar' => get_string('controlbar', 'mod_flexbook'),
        'interactionbar' => get_string('interactionbar', 'mod_flexbook'),
        'chaptertoggle' => get_string('chaptertoggle', 'mod_flexbook'),
        'share' => get_string('share', 'mod_flexbook'),
        'fullscreen' => get_string('fullscreen', 'mod_flexbook'),
        'xpcounter' => get_string('xpcounter', 'mod_flexbook'),
        'interactioncounter' => get_string('interactioncounter', 'mod_flexbook'),
        'interactionnavigation' => get_string('interactionnavigation', 'mod_flexbook'),
        'duolingotheme' => get_string('duolingotheme', 'mod_flexbook'),
    ],
));

$aspectratios = [
    '' => get_string('unset', 'mod_flexbook'),
    '16:9' => '16:9',
    '21:9' => '21:9',
    '9:16' => '9:16',
    '3:4' => '3:4',
    '4:3' => '4:3',
    '1:1' => '1:1',
];
$asettings->add(new admin_setting_configselect(
    'mod_flexbook/defaultaspectratio',
    get_string('aspectratio', 'mod_flexbook'),
    get_string('aspectratio', 'mod_flexbook'),
    '',
    $aspectratios,
));

$ADMIN->add('modfbfolder', $asettings);

// Behavior settings page.
$bsettings = new admin_settingpage('mod_flexbook_behavior', get_string('behaviorsettings', 'mod_flexbook'));

$bsettings->add(new admin_setting_configmulticheckbox(
    'mod_flexbook/defaultbehavior',
    get_string('defaultbehavior', 'mod_interactivevideo'),
    get_string('defaultbehavior_desc', 'mod_interactivevideo'),
    [],
    [
        'allowdeleteprogress' => get_string('allowdeleteprogress', 'mod_interactivevideo'),
        'preventskipping' => get_string('preventskip', 'mod_flexbook'),
    ],
));

$ADMIN->add('modfbfolder', $bsettings);

// Report settings page.
$rsettings = new admin_settingpage('mod_flexbook_report', get_string('reportsettings', 'mod_flexbook'));

$rsettings->add(new admin_setting_configmultiselect(
    'mod_flexbook/reportfields',
    get_string('reportfields', 'mod_interactivevideo'),
    get_string('reportfields_desc', 'mod_interactivevideo'),
    ['email'],
    $fields
));

$ADMIN->add('modfbfolder', $rsettings);
