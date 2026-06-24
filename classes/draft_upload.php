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
 * Multipart draft uploads for Flexbook DnD (large model packs).
 *
 * @package    mod_flexbook
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class draft_upload {
    /** @var string Form field name for the uploaded file. */
    public const FILE_FIELD = 'file';

    /**
     * Store a multipart upload in the current user's draft file area.
     *
     * @param int $contextid Module context id.
     * @param int $draftitemid Existing draft item id, or 0 to allocate one.
     * @param string $filepath Draft filepath (e.g. /186/).
     * @return array{itemid: int, url: string}
     */
    public static function store_uploaded_file(int $contextid, int $draftitemid = 0, string $filepath = '/'): array {
        global $CFG, $DB, $USER;

        require_once($CFG->libdir . '/filelib.php');

        \mod_flexbook\external\actions::validate_edit_context($contextid);

        $context = \context::instance_by_id($contextid);
        if ($context->contextlevel !== CONTEXT_MODULE) {
            throw new \moodle_exception('invalidcontext', 'error');
        }

        $cm = get_coursemodule_from_id('flexbook', $context->instanceid, 0, false, MUST_EXIST);
        $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
        $usercontext = \context_user::instance($USER->id);
        $fs = get_file_storage();

        if (empty($_FILES[self::FILE_FIELD])) {
            throw new \moodle_exception('invaliduploadcontent', 'mod_flexbook');
        }

        $upload = $_FILES[self::FILE_FIELD];
        if (!empty($upload['error']) && (int) $upload['error'] !== UPLOAD_ERR_OK) {
            throw new \moodle_exception('erroruploading', 'mod_flexbook', '', $upload['name'] ?? '');
        }

        if (empty($upload['tmp_name']) || !is_uploaded_file($upload['tmp_name'])) {
            throw new \moodle_exception('invaliduploadcontent', 'mod_flexbook');
        }

        $filename = clean_param($upload['name'], PARAM_FILE);
        if ($filename === '') {
            throw new \moodle_exception('invaliduploadcontent', 'mod_flexbook');
        }

        $filesize = filesize($upload['tmp_name']);
        if ($filesize === false || $filesize <= 0) {
            throw new \moodle_exception('invaliduploadcontent', 'mod_flexbook');
        }

        $maxbytes = get_max_upload_file_size($CFG->maxbytes, $course->maxbytes);
        if ($maxbytes > 0 && $filesize > $maxbytes) {
            throw new \moodle_exception('uploadfiletoolarge', 'mod_flexbook', '', display_size($maxbytes));
        }

        $itemid = $draftitemid > 0 ? $draftitemid : file_get_unused_draft_itemid();

        $filepath = '/' . trim($filepath, '/') . '/';
        if ($filepath === '//') {
            $filepath = '/';
        }

        $originalfilename = $filename;
        while ($fs->file_exists($usercontext->id, 'user', 'draft', $itemid, $filepath, $filename)) {
            $existing = $fs->get_file($usercontext->id, 'user', 'draft', $itemid, $filepath, $filename);
            $existing->delete();
        }

        $filerecord = [
            'contextid' => $usercontext->id,
            'component' => 'user',
            'filearea' => 'draft',
            'itemid' => $itemid,
            'filepath' => $filepath,
            'filename' => $filename,
        ];

        $fs->create_file_from_pathname($filerecord, $upload['tmp_name']);
        $url = \moodle_url::make_draftfile_url($itemid, $filepath, $filename);

        return [
            'itemid' => $itemid,
            'url' => $url->out(false),
        ];
    }
}
