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
 * Standalone embedded interaction viewer.
 *
 * Renders a single flexbook_items record for embedding in Pages, Books, or external iframes.
 * The id parameter is flexbook_items.id (interaction id), not the course module id.
 *
 * Optional URL params: dm (dark mode), kid (kid theme), forcetheme.
 * Full design and phase 2 roadmap: docs/embed.md in this plugin.
 *
 * @see docs/embed.md
 * @package    mod_flexbook
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Login is enforced in flexbook_validate_embed_access().
// phpcs:ignore moodle.Files.RequireLogin.Missing
require(__DIR__ . '/../../config.php');
require_once(__DIR__ . '/lib.php');

// Interaction id from flexbook_items table (not cmid).
$id = required_param('id', PARAM_INT);
$dmode = optional_param('dm', null, PARAM_INT);
$kid = optional_param('kid', null, PARAM_INT);
$forcetheme = optional_param('forcetheme', null, PARAM_TEXT);

$resolved = flexbook_validate_embed_access($id);
$item = $resolved['item'];
$cm = $resolved['cm'];
$course = $resolved['course'];
$modulecontext = $resolved['context'];

$jsonflags = JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT;

// Learner facing, so an unactivated content type must not resolve to a renderer.
$contentoptions = \mod_flexbook\util::get_usable_activitytypes();
$contenttype = null;
foreach ($contentoptions as $option) {
    if ($option['name'] === $item->type) {
        $contenttype = $option;
        break;
    }
}
if (!$contenttype) {
    throw new moodle_exception('invalidinteractiontype', 'mod_flexbook', '', $item->type);
}

$embedoptions = flexbook_build_embed_options($dmode, $kid);

$urlparams = ['id' => $id];
if ($dmode !== null) {
    $urlparams['dm'] = $dmode;
}
if ($kid !== null) {
    $urlparams['kid'] = $kid;
}
if ($forcetheme !== null && $forcetheme !== '') {
    $urlparams['forcetheme'] = $forcetheme;
}

$PAGE->set_url(new moodle_url('/mod/flexbook/embed.php', $urlparams));
$PAGE->set_context($modulecontext);
$PAGE->set_pagelayout('embedded');
$PAGE->activityheader->disable();

$PAGE->add_body_class('path-mod-flexbook');
$PAGE->add_body_class('path-mod-interactivevideo');
$PAGE->add_body_class('fb-embed-interaction');
// Not embed-mode: that class is for view.php IV iframe chrome and breaks embed.php layout
// (strips kidtheme card, reserves 55px for a missing controller bar).
$PAGE->add_body_class('distraction-free');
$PAGE->add_body_class($CFG->branch >= 500 ? 'bs-5' : '');

flexbook_apply_embed_page_display($embedoptions, $forcetheme);

$PAGE->set_title(get_string('embedinteraction', 'mod_flexbook'));
$PAGE->set_heading(format_string($item->title));

$PAGE->requires->jquery_plugin('ui-css');
$PAGE->requires->css(new moodle_url('/mod/interactivevideo/libraries/bootstrap-icons/bootstrap-icons.min.css'));
$PAGE->requires->js(
    new moodle_url('/mod/interactivevideo/libraries/confetti/confetti.browser.min.js'),
    true
);

$annotation = (array) mod_flexbook\util::get_item($id, $modulecontext->id);
$annotation['prop'] = json_encode($contenttype);
$annotation['displayoptions'] = 'inline';
$annotation['completed'] = false;

echo $OUTPUT->header();

$datafortemplate = [
    'containers' => [
        ['id' => 'annotation', 'content' => json_encode($annotation, $jsonflags)],
        ['id' => 'contenttypes', 'content' => json_encode($contentoptions, $jsonflags)],
        ['id' => 'doptions', 'content' => json_encode($embedoptions, $jsonflags)],
    ],
    'moodleversion' => $CFG->branch,
];

echo $OUTPUT->render_from_template('mod_flexbook/embed', $datafortemplate);

$PAGE->requires->js_call_amd('mod_flexbook/embed', 'init', [[
    'cmid' => $cm->id,
    'flexbook' => $cm->instance,
    'courseid' => $course->id,
    'userid' => 1,
    'itemid' => $id,
    'type' => $item->type,
    'isPreviewMode' => true,
    'isEmbedMode' => true,
    'isEditMode' => false,
    'iseditor' => false,
    'isGuest' => isguestuser(),
    'darkmode' => !empty($embedoptions['darkmode']),
]]);

echo $OUTPUT->footer();
