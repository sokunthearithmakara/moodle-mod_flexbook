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

defined('MOODLE_INTERNAL') || die();
require_once($CFG->dirroot . '/mod/interactivevideo/locallib.php');

/**
 * Class util
 *
 * @package    mod_flexbook
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class util extends \interactivevideo_util {
    /**
     * Get all activity types.
     *
     * @param bool $fromview Whether called from view.php.
     * @return array[] The list of activity types.
     */
    public static function get_all_activitytypes($fromview = false) {
        $subplugins = get_config('mod_flexbook', 'enablecontenttypes');
        $subplugins = explode(',', $subplugins);
        // If fromview, make sure to include ivplugin_chapter.
        if ($fromview && !in_array('ivplugin_chapter', $subplugins)) {
            $subplugins[] = 'ivplugin_chapter';
        }
        $subplugins = array_map(function ($subplugin) {
            return [
                'name' => $subplugin,
                'custom' => true,
                'class' => $subplugin . '\\main',
            ];
        }, $subplugins);

        $contentoptions = [];

        foreach ($subplugins as $subplugin) {
            $class = $subplugin['class'];

            if (!class_exists($class)) {
                continue;
            }

            $contenttype = new $class();
            if ($contenttype && $contenttype->can_used() && $contenttype->get_property()) {
                $properties = $contenttype->get_property();
                if (!isset($properties['flexbook']) || $properties['flexbook'] !== true) {
                    continue;
                }
                if (
                    !isset($properties['name']) || !isset($properties['class'])
                    || !isset($properties['amdmodule']) || !isset($properties['form'])
                ) {
                    continue;
                }
                if (!isset($properties['hascompletion'])) {
                    $properties['hascompletion'] = false;
                }
                if (!isset($properties['hastimestamp'])) {
                    $properties['hastimestamp'] = true;
                }
                if (!isset($properties['allowmultiple'])) {
                    $properties['allowmultiple'] = true;
                }
                if (!isset($properties['icon'])) {
                    $properties['icon'] = 'bi bi-cursor';
                }
                if (!isset($properties['title'])) {
                    $properties['title'] = get_string('unknowncontenttype', 'mod_interactivevideo');
                }
                if (!isset($properties['description'])) {
                    $properties['description'] = '';
                }
                if (!isset($properties['stringcomponent'])) {
                    $properties['stringcomponent'] = $subplugin['name'];
                }
                if (!isset($properties['initonreport'])) {
                    $properties['initonreport'] = false;
                }
                if (!isset($properties['preloadstrings'])) {
                    $properties['preloadstrings'] = true;
                }
                if ($fromview) { // Remove unneeded properties.
                    unset($properties['form']);
                    unset($properties['description']);
                    unset($properties['stringcomponent']);
                    unset($properties['initonreport']);
                    unset($properties['author']);
                    unset($properties['tutorial']);
                    unset($properties['pro']);
                }
                $contentoptions[] = $properties;
            }
        }

        // Make sure contentTypes do not have the same name key.
        $contentoptions = array_values(array_column($contentoptions, null, 'name'));
        return $contentoptions;
    }

    /** @var string[] All item file areas that travel with an interaction. */
    const ITEM_FILEAREAS = ['content', 'itext1', 'itext2', 'itext3', 'asset', 'public'];

    /**
     * Copy an interaction.
     *
     * @param int $id
     * @param int $contextid
     * @param float $timestamp
     * @return mixed|null
     */
    public static function copy_item($id, $contextid, $timestamp = 0): mixed {
        global $DB;
        $record = $DB->get_record('flexbook_items', ['id' => $id]);
        $record->title = $record->title . ' (' . get_string('copynoun', 'mod_interactivevideo') . ')';
        $oldid = (int) $record->id;
        $record->id = $DB->insert_record('flexbook_items', $record);

        // Copy every item file area into the new item (same context).
        self::copy_item_files($contextid, $contextid, $oldid, $record->id);

        // Reset cache.
        $cache = \cache::make('mod_flexbook', 'fb_items');
        $cache->delete($record->cmid);

        return self::get_item($record->id, $contextid);
    }

    /**
     * Copy all item file areas from one interaction to another.
     *
     * @param int $oldcontextid Source context id.
     * @param int $newcontextid Destination context id.
     * @param int $olditemid Source item id.
     * @param int $newitemid Destination item id.
     * @return void
     */
    public static function copy_item_files($oldcontextid, $newcontextid, $olditemid, $newitemid) {
        global $CFG;
        require_once($CFG->libdir . '/filelib.php');
        $fs = get_file_storage();
        foreach (self::ITEM_FILEAREAS as $area) {
            $files = $fs->get_area_files($oldcontextid, 'mod_flexbook', $area, $olditemid, 'id ASC', false);
            foreach ($files as $file) {
                $fs->create_file_from_storedfile([
                    'contextid' => $newcontextid,
                    'itemid' => $newitemid,
                ], $file);
            }
        }
    }

    /**
     * Append imported item ids to a flexbook instance sequence.
     *
     * @param int $instanceid The flexbook instance id (annotationid).
     * @param int[] $newids The newly created item ids, in display order.
     * @param int $afterid Insert after this existing item id, or 0 to append at the end.
     * @return string The updated sequence string.
     */
    public static function append_to_sequence($instanceid, array $newids, $afterid = 0) {
        global $DB;
        if (empty($newids)) {
            return '';
        }
        $flexbook = $DB->get_record('flexbook', ['id' => $instanceid]);
        if (!$flexbook) {
            return '';
        }
        $sequence = array_values(array_filter(explode(',', (string) $flexbook->sequence)));
        if ($afterid && ($index = array_search((string) $afterid, $sequence)) !== false) {
            array_splice($sequence, $index + 1, 0, $newids);
        } else {
            foreach ($newids as $newid) {
                $sequence[] = $newid;
            }
        }
        $flexbook->sequence = implode(',', $sequence);
        $DB->update_record('flexbook', $flexbook);
        return $flexbook->sequence;
    }

    /**
     * Import items into a flexbook instance from item records (clipboard paste / cross-activity).
     *
     * @param int $fromcourse Source course id.
     * @param int $tocourse Destination course id.
     * @param int $module Destination course module id.
     * @param int $fromcm Source course module id.
     * @param int $tocm Destination flexbook instance id (annotationid).
     * @param array $items The item records to import.
     * @param int $contextid Destination module context id.
     * @param int $afterid Insert after this existing item id, or 0 to append at the end.
     * @return array The created item records.
     */
    public static function import_items($fromcourse, $tocourse, $module, $fromcm, $tocm, $items, $contextid, $afterid = 0) {
        global $DB, $PAGE;
        if (empty($items)) {
            return [];
        }
        $PAGE->set_context(\context::instance_by_id($contextid));
        $first = (object) $items[0];
        $defaultoldcontext = !empty($first->contextid) ? (int) $first->contextid : $contextid;

        $copied = [];
        $idmap = [];
        $newids = [];
        foreach ($items as $item) {
            $item = (object) $item;
            $olditemcontext = !empty($item->contextid) ? (int) $item->contextid : $defaultoldcontext;
            $oldid = (int) $item->id;
            $item->courseid = $tocourse;
            $item->annotationid = $tocm;
            $item->cmid = $module;
            $item->id = null;
            $item->timecreated = time();
            $item->timemodified = time();
            $item->contextid = $contextid;
            $item->id = $DB->insert_record('flexbook_items', $item);
            $idmap[$oldid] = (int) $item->id;
            $newids[] = (int) $item->id;

            // Copy the item file areas across contexts.
            self::copy_item_files($olditemcontext, $contextid, $oldid, $item->id);

            // Duplicate the content bank entry when moving across courses.
            if ($item->type === 'contentbank' && $fromcourse != $tocourse) {
                self::copy_contentbank_content($item, $tocourse);
            }

            $item->formattedtitle = format_string($item->title);
            $copied[] = $item;
        }

        // Second pass: remap cross-interaction @@ANNOID# references.
        if (count($idmap) > 1) {
            foreach ($idmap as $newid) {
                $record = $DB->get_record('flexbook_items', ['id' => $newid], '*', MUST_EXIST);
                $record = self::remap_item_placeholders($record, $idmap);
                $DB->update_record('flexbook_items', $record);
            }
        }

        self::append_to_sequence($tocm, $newids, $afterid);

        $cache = \cache::make('mod_flexbook', 'fb_items');
        $cache->delete($module);

        return array_values($copied);
    }

    /**
     * Import items from an uploaded .fbz pack stored in the user draft area.
     *
     * @param int $contextid Destination module context id.
     * @param int $instanceid Destination flexbook instance id (annotationid).
     * @param int $module Destination course module id.
     * @param int $courseid Destination course id.
     * @param int $draftitemid User draft item id holding the uploaded .fbz file.
     * @param int $afterid Insert after this existing item id, or 0 to append at the end.
     * @return array{items: array, sequence: string}
     */
    public static function import_pack_from_draft($contextid, $instanceid, $module, $courseid, $draftitemid, $afterid = 0) {
        global $DB, $USER, $CFG, $PAGE;
        require_once($CFG->libdir . '/filelib.php');
        $PAGE->set_context(\context::instance_by_id($contextid));
        $usercontextid = \context_user::instance($USER->id)->id;
        $coursecontext = \context_course::instance($courseid);
        $fs = get_file_storage();

        // Locate the uploaded .fbz file in the user draft area.
        $files = $fs->get_area_files($usercontextid, 'user', 'draft', $draftitemid, 'id', false);
        $file = reset($files);
        if (!$file) {
            throw new \moodle_exception('invaliduploadcontent', 'mod_flexbook');
        }

        // Unpack the archive into the module context.
        $packer = get_file_packer('application/zip');
        $file->extract_to_storage($packer, $contextid, 'mod_flexbook', 'unpacked', $module, '/');

        $jsonfile = $fs->get_file($contextid, 'mod_flexbook', 'unpacked', $module, '/', 'items.json');
        if (!$jsonfile) {
            $fs->delete_area_files($contextid, 'mod_flexbook', 'unpacked', $module);
            throw new \moodle_exception('invalidpack', 'mod_flexbook');
        }

        $content = str_replace(['&lt;', '&gt;'], ['<', '>'], $jsonfile->get_content());
        $pack = json_decode($content);
        if (!is_object($pack) || ($pack->format ?? '') !== 'flexbook' || !isset($pack->items) || !is_array($pack->items)) {
            $fs->delete_area_files($contextid, 'mod_flexbook', 'unpacked', $module);
            throw new \moodle_exception('invalidpack', 'mod_flexbook');
        }

        $copied = [];
        $idmap = [];
        $newids = [];
        foreach ($pack->items as $item) {
            $item = (object) $item;
            $packfiles = isset($item->files) && is_array($item->files) ? $item->files : [];
            unset($item->files);
            $oldid = (int) $item->id;
            $item->id = null;
            $item->contextid = $contextid;
            $item->courseid = $courseid;
            $item->cmid = $module;
            $item->annotationid = $instanceid;
            $item->timecreated = time();
            $item->timemodified = time();
            $item->id = $DB->insert_record('flexbook_items', $item);
            $idmap[$oldid] = (int) $item->id;
            $newids[] = (int) $item->id;

            foreach ($packfiles as $packfile) {
                $packfile = (object) $packfile;
                $uploaded = $fs->get_file(
                    $contextid,
                    'mod_flexbook',
                    'unpacked',
                    $module,
                    '/',
                    $packfile->formattedfilename
                );
                if (!$uploaded) {
                    continue;
                }
                if ($item->type === 'contentbank') {
                    $uploaded->rename($uploaded->get_filepath(), $packfile->filename);
                    $contentbank = new \core_contentbank\contentbank();
                    $newcontent = $contentbank->create_content_from_file($coursecontext, $USER->id, $uploaded);
                    if ($newcontent) {
                        $item->contentid = $newcontent->get_id();
                        $DB->update_record('flexbook_items', $item);
                    }
                } else {
                    $fs->create_file_from_storedfile([
                        'contextid' => $contextid,
                        'component' => 'mod_flexbook',
                        'filearea' => $packfile->area ?? 'content',
                        'itemid' => $item->id,
                        'filepath' => '/',
                        'filename' => $packfile->filename,
                    ], $uploaded);
                }
            }

            $item->formattedtitle = format_string($item->title);
            $copied[] = $item;
        }

        // Remap cross-interaction @@ANNOID# references.
        if (count($idmap) > 1) {
            foreach ($idmap as $newid) {
                $record = $DB->get_record('flexbook_items', ['id' => $newid], '*', MUST_EXIST);
                $record = self::remap_item_placeholders($record, $idmap);
                $DB->update_record('flexbook_items', $record);
            }
        }

        $fs->delete_area_files($contextid, 'mod_flexbook', 'unpacked', $module);
        $sequence = self::append_to_sequence($instanceid, $newids, $afterid);

        $cache = \cache::make('mod_flexbook', 'fb_items');
        $cache->delete($module);

        return ['items' => array_values($copied), 'sequence' => $sequence];
    }

    /**
     * Package selected items (with their files) into a downloadable .fbz archive.
     *
     * @param string $items JSON encoded array of item records.
     * @param int $cmid The course module id.
     * @param int $courseid The course id.
     * @param int $contextid The module context id.
     * @return string The draft file download URL.
     */
    public static function download_items($items, $cmid, $courseid, $contextid) {
        global $USER, $CFG;
        require_once($CFG->libdir . '/filelib.php');
        $fs = get_file_storage();
        $usercontext = \context_user::instance($USER->id);
        $coursecontextid = \context_course::instance($courseid)->id;
        $items = json_decode($items);
        if (!is_array($items) || empty($items)) {
            throw new \moodle_exception('selectinteraction', 'mod_interactivevideo');
        }

        $items = array_map(function ($item) use ($contextid, $fs, $coursecontextid) {
            $item = (object) $item;
            $item->files = [];
            foreach (self::ITEM_FILEAREAS as $area) {
                $areafiles = $fs->get_area_files($contextid, 'mod_flexbook', $area, $item->id, 'id ASC', false);
                foreach ($areafiles as $file) {
                    if ($file->get_filename() === '.') {
                        continue;
                    }
                    $item->files[] = [
                        'filename' => $file->get_filename(),
                        'formattedfilename' => '$$' . $file->get_itemid() . '$$' . $file->get_filename(),
                        'itemid' => $file->get_itemid(),
                        'file' => $file,
                        'area' => $area,
                    ];
                }
            }
            // Content bank files live in the course context.
            if ($item->type === 'contentbank' && !empty($item->contentid)) {
                $cbfiles = $fs->get_area_files($coursecontextid, 'contentbank', 'public', $item->contentid);
                foreach ($cbfiles as $file) {
                    if ($file->get_filename() === '.') {
                        continue;
                    }
                    $item->files[] = [
                        'filename' => $file->get_filename(),
                        'formattedfilename' => '$$' . $file->get_itemid() . '$$' . $file->get_filename(),
                        'itemid' => $file->get_itemid(),
                        'file' => $file,
                        'area' => 'contentbank',
                    ];
                }
            }
            return $item;
        }, $items);

        // Collect the stored_file objects to archive.
        $archivefiles = [];
        foreach ($items as $item) {
            foreach ($item->files as $meta) {
                $archivefiles[] = $meta['file'];
            }
            // Strip the stored_file object out of the JSON metadata.
            $item->files = array_map(function ($meta) {
                unset($meta['file']);
                return $meta;
            }, $item->files);
        }

        $pack = ['format' => 'flexbook', 'version' => 1, 'items' => array_values($items)];

        // Write items.json to a draft area.
        $jsondraftid = file_get_unused_draft_itemid();
        $jsoninfo = [
            'contextid' => $usercontext->id,
            'component' => 'user',
            'filearea' => 'draft',
            'itemid' => $jsondraftid,
            'filepath' => '/',
            'filename' => 'items.json',
        ];
        $fs->delete_area_files($usercontext->id, 'user', 'draft', $jsondraftid);
        $fs->create_file_from_string($jsoninfo, json_encode($pack));
        $jsonfile = $fs->get_file($usercontext->id, 'user', 'draft', $jsondraftid, '/', 'items.json');

        // Build the .fbz archive.
        $zipper = new \zip_packer();
        $tempzip = tempnam($CFG->tempdir, (string) $cmid) . '.fbz';
        $archived = [];
        foreach ($archivefiles as $file) {
            $name = clean_param('$$' . $file->get_itemid() . '$$' . $file->get_filename(), PARAM_FILE);
            $archived[$name] = $file;
        }
        $archived['items.json'] = $jsonfile;
        $zipper->archive_to_pathname($archived, $tempzip);

        $zipdraftid = file_get_unused_draft_itemid();
        $zipinfo = [
            'contextid' => $usercontext->id,
            'component' => 'user',
            'filearea' => 'draft',
            'itemid' => $zipdraftid,
            'filepath' => '/',
            'filename' => $cmid . '.fbz',
        ];
        $fs->delete_area_files($usercontext->id, 'user', 'draft', $zipdraftid);
        $fs->create_file_from_pathname($zipinfo, $tempzip);
        @unlink($tempzip);

        return \moodle_url::make_draftfile_url($zipdraftid, '/', $cmid . '.fbz')->out(false);
    }

    /**
     * Duplicate a content bank entry into the destination course and update the item's contentid.
     *
     * @param \stdClass $item The newly inserted flexbook item (modified in place).
     * @param int $tocourse The destination course id.
     * @return \stdClass The item with the remapped contentid.
     */
    protected static function copy_contentbank_content($item, $tocourse) {
        global $DB;
        if (empty($item->contentid)) {
            return $item;
        }
        try {
            $record = $DB->get_record('contentbank_content', ['id' => $item->contentid], '*', MUST_EXIST);
            $newcoursecontext = \context_course::instance($tocourse);
            $contentbank = new \core_contentbank\contentbank();
            $content = $contentbank->get_content_from_id($record->id);
            $contenttype = $content->get_content_type_instance();
            $context = \context::instance_by_id($record->contextid, MUST_EXIST);
            if (!$contenttype->can_copy($content)) {
                return $item;
            }
            $crecord = $content->get_content();
            unset($crecord->id);
            $crecord->contextid = $newcoursecontext->id;
            if ($newcontent = $contenttype->create_content($crecord)) {
                $handler = \core_contentbank\customfield\content_handler::create();
                $handler->instance_form_before_set_data($record);
                $record->id = $newcontent->get_id();
                $handler->instance_form_save($record);

                $fs = get_file_storage();
                $files = $fs->get_area_files(
                    $context->id,
                    'contentbank',
                    'public',
                    $item->contentid,
                    'itemid, filepath, filename',
                    false
                );
                if (!empty($files)) {
                    $newcontent->import_file(reset($files));
                }
                $item->contentid = $newcontent->get_id();
                $DB->update_record('flexbook_items', $item);
                $newcontent->set_contextid($newcoursecontext->id);
            }
        } catch (\moodle_exception $e) {
            // The source content or context no longer exists; keep the original contentid.
            debugging('Flexbook content bank copy failed: ' . $e->getMessage(), DEBUG_DEVELOPER);
        }
        return $item;
    }

    /**
     * Get all interactions in one interactive video module.
     *
     * @param int $cmid The course module ID.
     * @param int $contextid The context ID.
     * @param bool $hascompletion Whether to filter by completion.
     * @return array[] The list of items.
     */
    public static function get_items($cmid, $contextid, $hascompletion = false) {
        global $DB, $PAGE;
        if ($contextid) {
            $PAGE->set_context(\context::instance_by_id($contextid));
        }
        $cache = \cache::make('mod_flexbook', 'fb_items');
        $items = $cache->get($cmid);
        if (!$items) {
            $items = $DB->get_records('flexbook_items', ['cmid' => $cmid]);
            $items = array_values($items);
            $cache->set($cmid, $items);
        }
        $items = (array)$items;
        if ($hascompletion) {
            $items = array_filter($items, function ($item) {
                $item = (array) $item;
                return (int) ($item['hascompletion'] ?? 0) === 1;
            });
        }
        $items = array_map(function ($item) use ($contextid) {
            $item = (array) $item;
            $item['formattedtitle'] = format_string($item['title']);
            if (empty($item['contextid'])) {
                $item['contextid'] = $contextid;
            }
            return $item;
        }, $items);
        return $items;
    }

    /**
     * Whether an interaction is global (not part of the navigation sequence).
     *
     * Global interactions are flagged by a negative stored timestamp (-1),
     * assigned on create for content types declaring allowmultiple: false.
     *
     * @param \stdClass|array $item The interaction record.
     * @return bool
     */
    public static function is_global_item($item): bool {
        $item = (array) $item;
        return isset($item['timestamp']) && (float) $item['timestamp'] < 0;
    }

    /**
     * Get one interaction by id.
     *
     * @param int $id The item ID.
     * @param int $contextid The context ID.
     * @return \stdClass|null The item record.
     */
    public static function get_item($id, $contextid) {
        global $DB, $PAGE;
        if ($contextid) {
            $PAGE->set_context(\context::instance_by_id($contextid));
        }
        $record = $DB->get_record('flexbook_items', ['id' => $id]);
        if (!$record) {
            return null;
        }
        $record->formattedtitle = format_string($record->title);
        if (empty($record->contextid)) {
            $record->contextid = $contextid;
        }
        return $record;
    }

    /**
     * Delete an item.
     *
     * @param int $id The item ID.
     * @param int $cmid The course module ID.
     * @param int $contextid The context ID.
     * @return int The deleted item ID.
     */
    public static function delete_item($id, $cmid, $contextid) {
        global $DB;
        $DB->delete_records('flexbook_items', ['id' => $id]);
        $logs = $DB->get_records('flexbook_log', ['annotationid' => $id]);
        $fs = get_file_storage();
        // Delete files.
        $fs->delete_area_files($contextid, 'mod_flexbook', 'content', $id);
        $fs->delete_area_files($contextid, 'mod_flexbook', 'public', $id);
        $fs->delete_area_files($contextid, 'mod_flexbook', 'itext1', $id);
        $fs->delete_area_files($contextid, 'mod_flexbook', 'itext2', $id);
        $fs->delete_area_files($contextid, 'mod_flexbook', 'itext3', $id);
        $fs->delete_area_files($contextid, 'mod_flexbook', 'asset', $id);
        // Delete logs files & logs.
        if ($logs) {
            foreach ($logs as $log) {
                $fs->delete_area_files($contextid, 'mod_flexbook', 'attachments', $log->id);
                $fs->delete_area_files($contextid, 'mod_flexbook', 'text1', $log->id);
                $fs->delete_area_files($contextid, 'mod_flexbook', 'text2', $log->id);
                $fs->delete_area_files($contextid, 'mod_flexbook', 'text3', $log->id);
            }
            $DB->delete_records('flexbook_log', ['annotationid' => $id]);
        }
        $cache = \cache::make('mod_flexbook', 'fb_items');
        $cache->delete($cmid);

        return $id;
    }

    /**
     * Create a new interaction instance by routing to the plugin's own creation method.
     *
     * @param string $type The interaction type (plugin name).
     * @param array $data The data for the new instance.
     * @return \stdClass The newly created interaction record.
     */
    public static function create_instance($type, $data) {
        global $DB;
        $subplugins = self::get_all_activitytypes();
        $plugininfo = array_filter($subplugins, fn($p) => $p['name'] === $type);
        $plugininfo = reset($plugininfo);

        if (!$plugininfo || !class_exists($plugininfo['class'])) {
            throw new \moodle_exception('invalidinteractiontype', 'mod_flexbook', '', $type);
        }

        $class = $plugininfo['class'];
        $plugin = new $class();

        $anchorid = isset($data['anchorid']) ? (int) $data['anchorid'] : 0;
        unset($data['anchorid']);

        // Apply course-level interaction defaults for drag-and-drop / programmatic creation.
        $data = self::merge_dnd_defaults($plugin, $type, $data);

        if (method_exists($plugin, 'create_instance')) {
            $item = $plugin->create_instance($data);
        } else {
            // Fallback for simple plugins: just insert into flexbook_items.
            $data = (object) $data;
            $data->id = $DB->insert_record('flexbook_items', $data);
            $item = self::get_item($data->id, $data->contextid);
        }

        // Handle sequence insertion.
        $flexbook = $DB->get_record('flexbook', ['id' => $item->annotationid]);
        if ($flexbook) {
            $sequence = explode(',', $flexbook->sequence);
            $sequence = array_filter($sequence); // Remove empty values.

            if (self::is_global_item($item)) {
                // Global interactions are always pinned at the top of the sequence.
                array_unshift($sequence, $item->id);
            } else if ($anchorid && ($index = array_search($anchorid, $sequence)) !== false) {
                // Insert after anchor.
                array_splice($sequence, $index + 1, 0, $item->id);
            } else {
                // Append to end.
                $sequence[] = $item->id;
            }

            $flexbook->sequence = implode(',', $sequence);
            $DB->update_record('flexbook', $flexbook);
        }

        // Clear cache.
        $cache = \cache::make('mod_flexbook', 'fb_items');
        $cache->delete($item->cmid);

        return $item;
    }

    /**
     * Quick edit a flexbook item
     *
     * @param int $id The item ID.
     * @param string $field The field name.
     * @param string $value The field value.
     * @param int $contextid The context ID.
     * @param int $draftitemid The draft item ID.
     * @param int $olddraftitemid The old draft item ID.
     * @return \stdClass The updated item record.
     */
    public static function quick_edit($id, $field, $value, $contextid, $draftitemid = 0, $olddraftitemid = 0) {
        global $DB, $CFG;
        if ($field == 'content') {
            require_once($CFG->libdir . '/filelib.php');
            $context = \context::instance_by_id($contextid);
            // Delete the old files before saving the new files.
            $fs = get_file_storage();
            $fs->delete_area_files($context->id, 'mod_flexbook', 'content', $id);

            // Use the provided draftitemid or fallback to request param.
            if (!$draftitemid) {
                $draftitemid = file_get_submitted_draft_itemid('content');
            }

            $postvalue = file_save_draft_area_files(
                $draftitemid,
                $contextid,
                'mod_flexbook',
                'content',
                $id,
                [
                    'maxfiles' => -1,
                    'maxbytes' => 0,
                    'trusttext' => true,
                    'noclean' => true,
                    'context' => $context,
                ],
                $value
            );

            // Remove orphaned files.
            self::file_remove_editor_orphaned_files($draftitemid, $value);
            if ($olddraftitemid) {
                self::file_remove_editor_orphaned_files($olddraftitemid, $value);
            }
            $value = $postvalue;
        }
        $DB->set_field('flexbook_items', $field, $value, ['id' => $id]);
        $item = self::get_item($id, $contextid);
        $cache = \cache::make('mod_flexbook', 'fb_items');
        $cache->delete($item->cmid);
        return $item;
    }

    /**
     * Remove orphaned files.
     *
     * @param int $draftid
     * @param string $text
     * @return void
     */
    public static function file_remove_editor_orphaned_files($draftid, $text) {
        global $CFG, $USER;
        if (!$draftid) {
            return;
        }
        // Find those draft files included in the text, and generate their hashes.
        $context = \context_user::instance($USER->id);
        $baseurl = $CFG->wwwroot . '/draftfile.php/' . $context->id . '/user/draft/' . $draftid . '/';
        $pattern = "/" . preg_quote($baseurl, '/') . "(.+?)[\?\"'<>\s:\\\\]/";
        preg_match_all($pattern, $text, $matches);
        $usedfilehashes = [];
        foreach ($matches[1] as $matchedfilename) {
            $matchedfilename = urldecode($matchedfilename);
            $usedfilehashes[] = \file_storage::get_pathname_hash(
                $context->id,
                'user',
                'draft',
                $draftid,
                '/',
                $matchedfilename
            );
        }

        // Now, compare the hashes of all draft files, and remove those which don't match used files.
        $fs = get_file_storage();
        $files = $fs->get_area_files($context->id, 'user', 'draft', $draftid, 'id', false);
        foreach ($files as $file) {
            $tmphash = $file->get_pathnamehash();
            if (!in_array($tmphash, $usedfilehashes)) {
                $file->delete();
            }
        }
    }

    /**
     * Get progress data per user.
     *
     * @param int $cmid The course module ID.
     * @param int $userid The user ID.
     * @param int $courseid The course ID.
     * @param bool $preview Whether it's a preview mode.
     * @return array|\stdClass The progress data.
     */
    public static function get_progress($cmid, $userid, $courseid = null, $preview = false) {
        global $DB;
        if ($userid == 1 || $preview || isguestuser()) {
            $cache = \cache::make('mod_flexbook', 'fb_progress');
            $progress = $cache->get($cmid);
            if (!$progress) {
                $progress = [
                    'cmid' => $cmid,
                    'completeditems' => '',
                    'xp' => 0,
                    'completionid' => 0,
                    'completionpercentage' => 0,
                    'userid' => $userid,
                    'completiondetails' => '',
                ];
                $cache->set($cmid, $progress);
            }
            return $progress;
        }

        $record = $DB->get_record('flexbook_completion', ['cmid' => $cmid, 'userid' => $userid]);
        if (!$record) {
            $record = new \stdClass();
            $record->cmid = $cmid;
            $record->userid = $userid;
            $record->timecreated = time();
            $record->timecompleted = 0;
            $record->completeditems = '[]';
            $record->completionpercentage = 0;
            $record->completiondetails = '[]';
            $record->courseid = $courseid;
            $record->id = $DB->insert_record('flexbook_completion', $record);
            $new = true;
        }
        return [$record, isset($new) ? $new : false];
    }

    /**
     * Save the progress of an flexbook for a user.
     *
     * @param int $cmid The ID of the course module.
     * @param int $userid The ID of the user.
     * @param string $completeditems JSON encoded string of completed items.
     * @param string $completiondetails JSON encoded string of completion details.
     * @param bool $markdone Whether to mark the item as done.
     * @param string $type The type of the interactive video.
     * @param string $details Additional details (optional).
     * @param int $completed Whether the interactive video is completed (optional, default is 0).
     * @param float $percentage The completion percentage (optional, default is 0).
     * @param float $grade The grade achieved (optional, default is 0).
     * @param int $gradeiteminstance The grade item instance (optional, default is 0).
     * @param int $xp The experience points earned (optional, default is 0).
     * @param bool $updatestate Whether to update the completion state (optional, default is true).
     * @param int $courseid The ID of the course (optional, default is 0).
     * @return \stdClass The updated progress record.
     */
    public static function save_progress(
        $cmid,
        $userid,
        $completeditems,
        $completiondetails,
        $markdone,
        $type,
        $details = '',
        $completed = 0,
        $percentage = 0,
        $grade = 0,
        $gradeiteminstance = 0,
        $xp = 0,
        $updatestate = true,
        $courseid = 0
    ) {
        global $DB, $CFG;
        $decodearray = function ($value): array {
            $decoded = json_decode((string) $value);
            return is_array($decoded) ? $decoded : [];
        };
        $completion = json_decode((string) $completiondetails);
        $completionid = is_object($completion) && isset($completion->id) ? $completion->id : null;
        $completeditems = json_encode(array_values($decodearray($completeditems)));

        // If guess user, save progress in the session; otherwise in the database.
        if ($userid == 1 || isguestuser()) {
            $cache = \cache::make('mod_flexbook', 'fb_progress');
            // First get the progress from the cache.
            $progress = [
                'cmid' => $cmid,
                'completeditems' => $completeditems,
                'completed' => $completed,
                'completionpercentage' => $percentage,
                'xp' => $xp,
                'userid' => $userid,
                'completionid' => 0,
                'completiondetails' => '[]',
            ];
            $currentprogress = $cache->get($cmid);
            if ($currentprogress && $completionid !== null) {
                $cdetails = $decodearray($currentprogress['completiondetails'] ?? '[]');
                // Remove the detail item with the same id.
                $cdetails = array_filter($cdetails, function ($item) use ($completionid) {
                    $item = json_decode($item);
                    return !is_object($item) || !isset($item->id) || $item->id != $completionid;
                });
                if ($markdone) {
                    $cdetails[] = $completiondetails;
                }
                $progress['completiondetails'] = json_encode(array_values($cdetails));
            }
            $cache->set($cmid, $progress);
            return $progress;
        }
        $record = $DB->get_record('flexbook_completion', ['cmid' => $cmid, 'userid' => $userid]);
        if (!$record) {
            $record = new \stdClass();
            $record->cmid = $cmid;
            $record->userid = $userid;
            $record->timecreated = time();
            $record->timecompleted = 0;
            $record->completeditems = '[]';
            $record->completionpercentage = 0;
            $record->completiondetails = '[]';
            $record->courseid = $courseid;
            $record->id = $DB->insert_record('flexbook_completion', $record);
        }
        $record->completeditems = $completeditems;
        $record->timecompleted = $completed ? time() : 0;
        $record->completionpercentage = round($percentage);
        $record->xp = $xp;
        $record->courseid = $courseid;
        if ($completionid !== null) {
            $cdetails = $decodearray($record->completiondetails);
            // Remove the detail item with the same id.
            $cdetails = array_filter($cdetails, function ($item) use ($completionid) {
                $item = json_decode($item);
                return !is_object($item) || !isset($item->id) || $item->id != $completionid;
            });
            if ($markdone) {
                $cdetails[] = $completiondetails;
            }
            $record->completiondetails = json_encode(array_values($cdetails));
        }
        $DB->update_record('flexbook_completion', $record);

        // Add/delete details to flexbook_log table.
        if (is_object($completion) && !empty($completion->hasDetails) && $completionid !== null) {
            if (!$markdone) {
                $DB->delete_records_select('flexbook_log', "annotationid = :annotationid AND userid = :userid", [
                    'annotationid' => $completionid,
                    'userid' => $userid,
                ]);
            } else {
                // Check if the log already exists.
                $existing = $DB->get_record('flexbook_log', [
                    'annotationid' => $completionid,
                    'userid' => $userid,
                    'completionid' => $record->id,
                ]);
                if (!$existing) {
                    $log = new \stdClass();
                    $log->userid = $userid;
                    $log->cmid = $cmid;
                    $log->char1 = $type;
                    $log->annotationid = $completionid;
                    $log->timecreated = time();
                    $log->text1 = $details;
                    $log->timemodified = time();
                    $log->completionid = $record->id;  // Store the completion id.
                    $DB->insert_record('flexbook_log', $log);
                } else {
                    $existing->text1 = $details;
                    $existing->timemodified = time();
                    $existing->completionid = $record->id;  // Store the completion id.
                    $DB->update_record('flexbook_log', $existing);
                }
            }
        }

        // Update grade.
        if ($gradeiteminstance > 0) {
            require_once($CFG->libdir . '/gradelib.php');
            $gradeitem = new \stdClass();
            $gradeitem->userid = $userid;
            $gradeitem->rawgrade = $grade;
            if ($grade <= 0) {
                $gradeitem->rawgrade = null;
            }
            grade_update('mod/flexbook', $courseid, 'mod', 'flexbook', $gradeiteminstance, 0, $gradeitem);

            $record->grade = $grade;
            $record->gradeiteminstance = $gradeiteminstance;
            $record->gradeitem = $gradeitem;
        }

        // Update completion state.
        if ($updatestate) {
            $modinfo = get_fast_modinfo($courseid);
            $cm = $modinfo->get_cm($cmid);
            if ($cm->completion > 1) {
                require_once($CFG->libdir . '/completionlib.php');
                $course = new \stdClass();
                $course->id = $courseid;
                $completion = new \completion_info($course);
                $completion->update_state($cm);
                $record->overallcomplete = $completion->internal_get_state($cm, $userid, null);
            }
        }

        return $record;
    }

    /**
     * Get report data by group.
     *
     * @param int $cmid
     * @param int $group
     * @param int $contextid
     * @param int $courseid
     * @return array
     */
    public static function get_report_data_by_group($cmid, $group, $contextid, $courseid = 0) {
        global $DB, $OUTPUT, $PAGE, $CFG;
        require_once($CFG->dirroot . '/user/profile/lib.php');
        require_once($CFG->dirroot . '/user/lib.php');
        $context = \context::instance_by_id($contextid);
        $PAGE->set_context($context);

        if (!$courseid) {
            $cm = get_coursemodule_from_id('flexbook', $cmid);
            $courseid = $cm->course;
        }
        $coursecontext = \context_course::instance($courseid);

        // Prepare user fields using the modern Moodle API.
        // This handles both core fields and custom profile fields efficiently with joins.
        $identityfields = get_config('mod_flexbook', 'reportfields');
        $extrafields = !empty($identityfields) ? explode(',', $identityfields) : [];
        $extrafields = array_map('strtolower', $extrafields);

        // Fetch custom field metadata once to avoid N+1 queries.
        $customfieldmetadata = [];
        if (!empty($extrafields)) {
            $customfieldshortnames = [];
            foreach ($extrafields as $field) {
                if (strpos($field, 'profile_field_') === 0) {
                    $customfieldshortnames[] = str_replace('profile_field_', '', $field);
                }
            }
            if (!empty($customfieldshortnames)) {
                [$insql, $inparams] = $DB->get_in_or_equal($customfieldshortnames, SQL_PARAMS_NAMED);
                $customfieldmetadata = $DB->get_records_select(
                    'user_info_field',
                    "shortname $insql",
                    $inparams,
                    '',
                    'shortname, datatype as type, id'
                );
                $customfieldmetadata = array_change_key_case($customfieldmetadata, CASE_LOWER);
            }
        }

        // Pre-instantiate field objects and prepare mapping to avoid overhead inside the student loop.
        $fieldobjects = [];
        $customfieldmap = [];
        foreach ($extrafields as $field) {
            if (strpos($field, 'profile_field_') === 0) {
                $shortname = str_replace('profile_field_', '', $field);
                $metadata = $customfieldmetadata[$shortname] ?? null;
                if ($metadata) {
                    if (!isset($fieldobjects[$metadata->id])) {
                        require_once($CFG->dirroot . '/user/profile/field/' . $metadata->type . '/field.class.php');
                        $classname = 'profile_field_' . $metadata->type;
                        $fieldobjects[$metadata->id] = new $classname($metadata->id);
                    }
                    $customfieldmap[$field] = [
                        'shortname' => $shortname,
                        'type' => $metadata->type,
                        'id' => $metadata->id,
                        'lowercased' => strtolower($field),
                    ];
                }
            }
        }

        // We use for_userpic() as a base and add identity fields.
        $userfields = \core_user\fields::for_userpic()->with_identity($context)->including(...$extrafields);
        $fieldsql = $userfields->get_sql('u', true, '', '', false);

        // Graded roles.
        $roles = get_config('core', 'gradebookroles');
        if (empty($roles)) {
            return [];
        }
        [$inparams, $inparamsvalues] = $DB->get_in_or_equal(explode(',', $roles), SQL_PARAMS_NAMED);

        if ($group == 0) {
            // Get all enrolled users (student only).
            $sql = "SELECT {$fieldsql->selects}, ac.timecompleted, ac.timecreated,
                           ac.completionpercentage, ac.completeditems, ac.xp, ac.completiondetails, ac.id as completionid
                    FROM {user} u
                    {$fieldsql->joins}
                    LEFT JOIN {flexbook_completion} ac ON ac.userid = u.id AND ac.cmid = :cmid
                    WHERE u.id IN (SELECT userid FROM {role_assignments} WHERE contextid = :coursecontextid AND roleid $inparams)
                    ORDER BY u.lastname, u.firstname";
            $params = array_merge($fieldsql->params, ['cmid' => $cmid, 'coursecontextid' => $coursecontext->id], $inparamsvalues);
        } else {
            // Get users in group (student only).
            $sql = "SELECT {$fieldsql->selects}, ac.timecompleted, ac.timecreated,
                           ac.completionpercentage, ac.completeditems, ac.xp, ac.completiondetails, ac.id as completionid
                    FROM {user} u
                    {$fieldsql->joins}
                    LEFT JOIN {flexbook_completion} ac ON ac.userid = u.id AND ac.cmid = :cmid
                    WHERE u.id IN (SELECT userid FROM {groups_members} WHERE groupid = :groupid)
                    AND u.id IN (SELECT userid FROM {role_assignments} WHERE contextid = :coursecontextid AND roleid $inparams)
                    ORDER BY u.lastname, u.firstname";
            $params = array_merge(
                $fieldsql->params,
                ['cmid' => $cmid, 'groupid' => $group, 'coursecontextid' => $coursecontext->id],
                $inparamsvalues
            );
        }

        $records = [];
        $rs = $DB->get_recordset_sql($sql, $params);
        foreach ($rs as $record) {
            // Render the photo of the user.
            $userpic = new \user_picture($record);
            $userpic->link = false;
            $userpic->includefullname = true;
            $record->pictureonly = $OUTPUT->render($userpic);
            $userpic->courseid = $courseid;
            $userpic->link = true;
            $userpic->popup = true;
            $record->picture = $OUTPUT->render($userpic);
            $record->fullname = fullname($record);

            // Handle custom fields efficiently using the pre-calculated map.
            $record->customfields = [];
            foreach ($customfieldmap as $info) {
                $field = $info['lowercased'];
                if (isset($record->{$field})) {
                    $fieldobj = $fieldobjects[$info['id']];
                    $fieldobj->data = $record->{$field};
                    $formatted = $fieldobj->display_data();

                    $record->customfields[] = [
                        'shortname' => $info['shortname'],
                        'type' => $info['type'],
                        'value' => $record->{$field}, // Raw value.
                        'formatted' => $formatted,
                    ];
                } else {
                    $record->{$field} = '';
                }
            }

            $records[$record->id] = $record;
        }
        $rs->close();

        return $records;
    }

    /**
     * Delete progress by ID.
     *
     * @param int $contextid
     * @param int $recordid
     * @param int $courseid
     * @param int $cmid
     * @return string
     */
    public static function delete_progress_by_id($contextid, $recordid, $courseid, $cmid) {
        global $DB, $CFG;
        $DB->delete_records('flexbook_completion', ['id' => $recordid]);
        $logs = $DB->get_records('flexbook_log', ['completionid' => $recordid], 'id', 'id, userid');
        if ($logs) {
            $fs = get_file_storage();
            foreach ($logs as $log) {
                $fs->delete_area_files($contextid, 'mod_flexbook', 'attachments', $log->id);
                $fs->delete_area_files($contextid, 'mod_flexbook', 'text1', $log->id);
                $fs->delete_area_files($contextid, 'mod_flexbook', 'text2', $log->id);
                $fs->delete_area_files($contextid, 'mod_flexbook', 'text3', $log->id);
            }
            $DB->delete_records('flexbook_log', ['completionid' => $recordid]);
        }
        $userids = array_column($logs, 'userid');
        $userids = array_unique($userids);
        $userids = array_values($userids);
        $cm = get_coursemodule_from_id('flexbook', $cmid);
        require_once($CFG->libdir . '/completionlib.php');
        if ($cm->completion == COMPLETION_TRACKING_AUTOMATIC) {
            $course = new \stdClass();
            $course->id = $courseid;
            $completion = new \completion_info($course);
            foreach ($userids as $userid) {
                $completion->update_state($cm, null, $userid);
            }
        }
        return 'deleted';
    }

    /**
     * Delete progress by IDs.
     *
     * @param int $contextid
     * @param array $recordids
     * @param int $courseid
     * @param int $cmid
     * @return string
     */
    public static function delete_progress_by_ids($contextid, $recordids, $courseid, $cmid) {
        global $DB, $CFG;
        $DB->delete_records_list('flexbook_completion', 'id', $recordids);
        $logs = $DB->get_records_list('flexbook_log', 'completionid', $recordids, 'id', 'id, userid');
        if ($logs) {
            $fs = get_file_storage();
            foreach ($logs as $log) {
                $fs->delete_area_files($contextid, 'mod_flexbook', 'attachments', $log->id);
                $fs->delete_area_files($contextid, 'mod_flexbook', 'text1', $log->id);
                $fs->delete_area_files($contextid, 'mod_flexbook', 'text2', $log->id);
                $fs->delete_area_files($contextid, 'mod_flexbook', 'text3', $log->id);
            }
            $DB->delete_records_list('flexbook_log', 'completionid', $recordids);
        }
        $cm = get_coursemodule_from_id('flexbook', $cmid);
        require_once($CFG->libdir . '/completionlib.php');
        if ($cm->completion == COMPLETION_TRACKING_AUTOMATIC) {
            $course = new \stdClass();
            $course->id = $courseid;
            $completion = new \completion_info($course);
            $userids = array_column($logs, 'userid');
            $userids = array_unique($userids);
            $userids = array_values($userids);
            foreach ($userids as $userid) {
                $completion->update_state($cm, null, $userid);
            }
        }
        return 'deleted';
    }

    /**
     * Delete flexbook_log rows (and file areas) for one user/interaction pair.
     *
     * @param int $userid
     * @param int $itemid Interaction id
     * @param int $contextid
     * @return void
     */
    public static function delete_interaction_logs($userid, $itemid, $contextid) {
        global $DB;
        $logs = $DB->get_records('flexbook_log', ['userid' => $userid, 'annotationid' => $itemid]);
        if (!$logs) {
            return;
        }
        $fs = get_file_storage();
        foreach ($logs as $log) {
            $fs->delete_area_files($contextid, 'mod_flexbook', 'attachments', $log->id);
            $fs->delete_area_files($contextid, 'mod_flexbook', 'text1', $log->id);
            $fs->delete_area_files($contextid, 'mod_flexbook', 'text2', $log->id);
            $fs->delete_area_files($contextid, 'mod_flexbook', 'text3', $log->id);
        }
        $DB->delete_records('flexbook_log', ['userid' => $userid, 'annotationid' => $itemid]);
    }

    /**
     * Delete completion data.
     *
     * @param int $id
     * @param int $itemid
     * @param int $userid
     * @param int $contextid
     * @return string
     */
    public static function delete_completion_data($id, $itemid, $userid, $contextid) {
        global $DB;
        $completion = $DB->get_record('flexbook_completion', ['id' => $id]);
        if ($completion) {
            $completeditems = json_decode($completion->completeditems);
            $key = array_search($itemid, $completeditems);
            if ($key !== false) {
                unset($completeditems[$key]);
                $completion->completeditems = json_encode(array_values($completeditems));
            }
            $completiondetails = json_decode($completion->completiondetails);
            $completiondetails = array_map(function ($item) use ($itemid) {
                $decoded = json_decode($item);
                if ($decoded->id == $itemid) {
                    $new = [
                        'id' => $decoded->id,
                        'deleted' => true,
                    ];
                    return json_encode($new);
                }
                return json_encode($decoded);
            }, $completiondetails);
            $completion->completiondetails = json_encode(array_values($completiondetails));
            // Remove from details (timespent and views).
            $details = json_decode($completion->details, true);
            if (is_array($details) && isset($details[$itemid])) {
                unset($details[$itemid]);
                $completion->details = json_encode($details);
            }
            $DB->update_record('flexbook_completion', $completion);
            self::delete_interaction_logs($userid, $itemid, $contextid);
            return json_encode(['id' => $id, 'itemid' => $itemid]);
        }

        self::delete_interaction_logs($userid, $itemid, $contextid);
        return json_encode(['id' => $id, 'itemid' => $itemid]);
    }

    /**
     * Override the earned XP of a single completed interaction for a user.
     *
     * Recalculates the row total XP and the gradebook grade, and keeps the
     * per-item percent and reportView in sync so the learner view reflects the
     * overridden value on revisit.
     *
     * @param int $id The completion record id.
     * @param int $itemid The interaction item id.
     * @param int $userid The user id.
     * @param int $contextid The module context id.
     * @param float $newxp The overridden earned XP (0..item max).
     * @param int $courseid The course id.
     * @param string|null $reportview Client-built reportView (optional).
     * @return string JSON-encoded result.
     */
    public static function override_completion_xp($id, $itemid, $userid, $contextid, $newxp, $courseid = 0, $reportview = null) {
        global $DB, $CFG;

        $context = \context::instance_by_id($contextid);
        require_capability('mod/flexbook:editreport', $context);

        $record = $DB->get_record('flexbook_completion', ['id' => $id]);
        if (!$record) {
            return json_encode(['error' => 'Completion record not found']);
        }
        $userid = $record->userid;
        $cmid = $record->cmid;
        if (!$courseid) {
            $courseid = $record->courseid;
        }

        // Gradable items for this activity (cmid here is the course module id).
        $items = (array) self::get_items($cmid, $contextid, true);
        $itemmaxmap = [];
        $totalmax = 0;
        foreach ($items as $item) {
            $item = (array) $item;
            $itemmaxmap[(string)$item['id']] = (float)$item['xp'];
            $totalmax += (float)$item['xp'];
        }

        if (!isset($itemmaxmap[(string)$itemid])) {
            return json_encode(['error' => 'Interaction not found or not gradable']);
        }
        $itemmax = $itemmaxmap[(string)$itemid];

        // Validate bounds: 0..item max.
        $newxp = (float)$newxp;
        if ($newxp < 0 || ($itemmax > 0 && $newxp > $itemmax) || ($itemmax <= 0 && $newxp != 0)) {
            return json_encode(['error' => 'invalidxpvalue']);
        }

        $completeditems = json_decode($record->completeditems);
        if (!is_array($completeditems)) {
            $completeditems = [];
        }
        if (!in_array((string)$itemid, array_map('strval', $completeditems), true)) {
            return json_encode(['error' => 'Interaction not completed']);
        }

        $rawdetails = json_decode($record->completiondetails);
        if (!is_array($rawdetails)) {
            $rawdetails = [];
        }

        $found = false;
        $updateditemdetail = null;
        $rawdetails = array_map(function ($entry) use ($itemid, $itemmax, $newxp, $reportview, &$found, &$updateditemdetail) {
            $decoded = json_decode($entry);
            if ($decoded && isset($decoded->id) && $decoded->id == $itemid && empty($decoded->deleted)) {
                $decoded->xp = $newxp;
                $decoded->percent = $itemmax > 0 ? ($newxp / $itemmax) : 0;
                $decoded->xpOverridden = true;
                if (isset($decoded->reportView)) {
                    if ($reportview !== null && $reportview !== '') {
                        $clean = clean_param($reportview, PARAM_RAW);
                        if ($clean !== '' && strlen($clean) <= 4096) {
                            $decoded->reportView = $clean;
                        } else {
                            $decoded->reportView = \mod_interactivevideo\report_helper::patch_report_view_xp(
                                $decoded->reportView,
                                $newxp
                            );
                        }
                    } else {
                        $decoded->reportView = \mod_interactivevideo\report_helper::patch_report_view_xp(
                            $decoded->reportView,
                            $newxp
                        );
                    }
                }
                $found = true;
                $updateditemdetail = $decoded;
            }
            return json_encode($decoded);
        }, $rawdetails);

        if (!$found) {
            return json_encode(['error' => 'Interaction completion not found']);
        }

        $record->completiondetails = json_encode(array_values($rawdetails));

        // Re-sum earned XP from the updated, non-deleted, completed details.
        $decodeddetails = array_map(fn($entry) => json_decode($entry), $rawdetails);
        $earned = \mod_interactivevideo\report_helper::sum_earned_xp($decodeddetails, $completeditems);
        $record->xp = $earned;

        $DB->update_record('flexbook_completion', $record);

        // Recalculate and update the gradebook grade.
        require_once($CFG->libdir . '/gradelib.php');
        $cm = get_coursemodule_from_id('flexbook', $cmid, 0, false, MUST_EXIST);
        $instanceid = $cm->instance;
        $grade = null;
        $gradeitem = \grade_item::fetch([
            'iteminstance' => $instanceid,
            'itemtype' => 'mod',
            'itemmodule' => 'flexbook',
            'courseid' => $courseid,
        ]);
        if ($gradeitem) {
            $grade = \mod_interactivevideo\report_helper::calculate_grade($earned, $totalmax, (float)$gradeitem->grademax);
            $gradeobj = new \stdClass();
            $gradeobj->userid = $userid;
            $gradeobj->rawgrade = ($grade === null || $grade <= 0) ? null : $grade;
            grade_update('mod/flexbook', $courseid, 'mod', 'flexbook', $instanceid, 0, $gradeobj);
        }

        return json_encode([
            'id' => $id,
            'itemid' => $itemid,
            'xp' => $earned,
            'itemxp' => $newxp,
            'completiondetails' => $record->completiondetails,
            'itemdetail' => $updateditemdetail,
            'grade' => $grade,
        ]);
    }

    /**
     * Save log.
     *
     * @param int $userid The user ID.
     * @param int $annotationid The annotation ID.
     * @param int $cmid The course module ID.
     * @param string $data The log data.
     * @param int $contextid The context ID.
     * @param int $replace Whether to replace existing log.
     * @return \stdClass The saved log record.
     */
    public static function save_log($userid, $annotationid, $cmid, $data, $contextid, $replace) {
        global $DB;
        $record = json_decode($data);
        $record->userid = $userid;
        $record->annotationid = $annotationid;
        $record->cmid = $cmid;
        $record->timecreated = time();
        $record->timemodified = time();
        if ($replace) {
            $existingrecord = $DB->get_record('flexbook_log', ['userid' => $userid, 'annotationid' => $annotationid]);
            if ($existingrecord) {
                $record->id = $existingrecord->id;
                $record->timemodified = time();
                $DB->update_record('flexbook_log', $record);
            } else {
                $record->id = $DB->insert_record('flexbook_log', $record);
            }
        } else {
            $record->id = $DB->insert_record('flexbook_log', $record);
        }
        $record->formattedtimecreated = userdate($record->timecreated, get_string('strftimedatetime', 'langconfig'));
        $record->formattedtimemodified = userdate($record->timemodified, get_string('strftimedatetime', 'langconfig'));

        return $record;
    }

    /**
     * Get logs by userids.
     *
     * @param array $userids
     * @param int $annotationid
     * @param int $contextid
     * @param string $type
     * @param int $cmid
     * @return array
     */
    public static function get_logs_by_userids($userids, $annotationid, $contextid, $type, $cmid) {
        global $DB, $CFG;
        require_once($CFG->libdir . '/filelib.php');
        $userids = array_values(array_filter(array_map('intval', $userids), fn($userid) => $userid > 0));
        if (empty($userids)) {
            return [];
        }

        [$insql, $inparams] = $DB->get_in_or_equal($userids, SQL_PARAMS_NAMED, 'userid');
        $where = "userid $insql";
        $params = $inparams;
        if ($annotationid != 0) {
            $where .= " AND annotationid = :annotationid";
            $params['annotationid'] = $annotationid;
        }
        if ($type) {
            $where .= " AND char1 = :type AND cmid = :cmid";
            $params['type'] = $type;
            $params['cmid'] = $cmid;
        }
        $sql = "SELECT * FROM {flexbook_log} WHERE {$where} ORDER BY
        timecreated DESC";
        $records = $DB->get_records_sql($sql, $params);
        foreach ($records as $record) {
            $record->formattedtimecreated = userdate($record->timecreated, get_string('strftimedatetime', 'langconfig'));
            $record->formattedtimemodified = userdate($record->timemodified, get_string('strftimedatetime', 'langconfig'));
            $record->text1 = self::process_text($record->text1, $contextid, 'text1', $record->id);
            $record->text2 = self::process_text($record->text2, $contextid, 'text2', $record->id);
            $record->text3 = self::process_text($record->text3, $contextid, 'text3', $record->id);
        }
        return array_values($records);
    }

    /**
     * Processes the given text within a specific context.
     *
     * @param string $text The text to be processed.
     * @param int $contextid The ID of the context in which the text is being processed.
     * @param string $field The field associated with the text.
     * @param int $id The ID related to the text processing.
     *
     * @return string The processed text.
     */
    public static function process_text($text, $contextid, $field, $id) {
        if (!$text) {
            return $text;
        }
        $text = file_rewrite_pluginfile_urls(
            str_replace('\\/', '/', $text),
            'pluginfile.php',
            $contextid,
            'mod_flexbook',
            $field,
            $id
        );
        $text = self::encode_text($text);
        return $text;
    }

    /**
     * Render a hidden div with the Moodle version branch.
     *
     * @return string The HTML for the hidden div.
     */
    public static function render_moodle_version() {
        global $CFG;
        return '<div id="mod_flexbook_moodle_version" class="d-none" data-version="' . $CFG->branch . '"></div>';
    }

    /**
     * Save interaction-type course defaults to the flexbook_defaults table.
     *
     * Each entry is upserted by (courseid, type). Only columns that exist in
     * the flexbook_defaults table are persisted; item-specific fields are dropped.
     *
     * @param array $defaults The list of default records to save.
     * @return array The saved default records.
     */
    public static function save_defaults($defaults) {
        global $DB;
        if (!is_array($defaults) || empty($defaults)) {
            throw new \moodle_exception('invaliddefaults', 'mod_flexbook');
        }
        $columns = $DB->get_columns('flexbook_defaults');
        $saved = [];
        foreach ($defaults as $default) {
            $default = (array) $default;
            $record = [];
            foreach ($columns as $name => $column) {
                if ($name === 'id') {
                    continue;
                }
                if (array_key_exists($name, $default)) {
                    $record[$name] = $default[$name];
                }
            }
            $record = (object) $record;
            if (empty($record->type) || empty($record->courseid)) {
                continue;
            }
            $record->timecreated = time();
            $record->timemodified = time();
            $existingrecord = $DB->get_record('flexbook_defaults', [
                'type' => $record->type,
                'courseid' => $record->courseid,
            ], 'id', IGNORE_MISSING);
            if ($existingrecord) {
                $record->id = $existingrecord->id;
                $DB->update_record('flexbook_defaults', $record);
            } else {
                $record->id = $DB->insert_record('flexbook_defaults', $record);
            }
            $saved[] = $record;
        }
        return $saved;
    }

    /**
     * Get all saved interaction-type defaults for a course.
     *
     * @param int $courseid The course ID.
     * @return array The default records ordered by type.
     */
    public static function get_course_defaults($courseid) {
        global $DB;
        return array_values($DB->get_records('flexbook_defaults', ['courseid' => $courseid], 'type ASC'));
    }

    /**
     * Delete a saved interaction-type default for a course.
     *
     * @param int $courseid The course ID.
     * @param string $type The interaction type.
     * @return void
     */
    public static function delete_default($courseid, $type) {
        global $DB;
        $DB->delete_records('flexbook_defaults', ['courseid' => $courseid, 'type' => $type]);
    }

    /**
     * Merge course-level defaults into the data used to create an interaction via
     * drag-and-drop or programmatic creation.
     *
     * Only the fields the content type opts into (via get_dnd_default_fields()) are
     * applied, so the dropped-file payload (content, url, etc.) is preserved.
     *
     * @param object $plugin The content-type plugin instance.
     * @param string $type The interaction type.
     * @param array $data The data passed to create_instance().
     * @return array The data with defaults merged in.
     */
    protected static function merge_dnd_defaults($plugin, $type, array $data) {
        global $DB;
        if (empty($data['courseid']) || !method_exists($plugin, 'get_dnd_default_fields')) {
            return $data;
        }
        $fields = $plugin->get_dnd_default_fields();
        if (empty($fields)) {
            return $data;
        }
        $defaults = $DB->get_record('flexbook_defaults', [
            'courseid' => $data['courseid'],
            'type' => $type,
        ], '*', IGNORE_MISSING);
        if (!$defaults) {
            return $data;
        }
        $skip = ['id', 'courseid', 'type', 'timecreated', 'timemodified'];
        foreach ($fields as $field) {
            if (in_array($field, $skip, true) || !property_exists($defaults, $field)) {
                continue;
            }
            if ($field === 'advanced') {
                $keys = method_exists($plugin, 'get_dnd_advanced_default_keys')
                    ? $plugin->get_dnd_advanced_default_keys() : null;
                $data['advanced'] = self::merge_advanced_default($defaults->advanced, $data['advanced'] ?? null, $keys);
                continue;
            }
            $data[$field] = $defaults->{$field};
        }
        return $data;
    }

    /**
     * Merge a default advanced settings JSON blob with any DND-provided advanced settings.
     *
     * Default values fill in missing keys; values already present in the DND payload win.
     *
     * @param string|null $defaultadvanced The default advanced settings as JSON.
     * @param string|null $dataadvanced The DND-provided advanced settings as JSON.
     * @param array|null $keys Optional subset of default keys to apply (null = all).
     * @return string|null The merged advanced settings as JSON.
     */
    protected static function merge_advanced_default($defaultadvanced, $dataadvanced, $keys = null) {
        $default = json_decode((string) $defaultadvanced, true);
        if (!is_array($default)) {
            return $dataadvanced;
        }
        if ($keys !== null) {
            $default = array_intersect_key($default, array_flip($keys));
        }
        $existing = [];
        if (!empty($dataadvanced)) {
            $decoded = json_decode($dataadvanced, true);
            if (is_array($decoded)) {
                $existing = $decoded;
            }
        }
        return json_encode(array_merge($default, $existing));
    }
}
