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
 * Structure step to restore one Flexbook activity
 *
 * @package    mod_flexbook
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class restore_flexbook_activity_structure_step extends restore_activity_structure_step {
    /**
     * Structure step to restore one flexbook activity
     *
     * @return array
     */
    protected function define_structure() {

        $paths = [];
        $userinfo = $this->get_setting_value('userinfo');

        $paths[] = new restore_path_element('flexbook', '/activity/flexbook');
        $paths[] = new restore_path_element('annotationitems', '/activity/flexbook/items/item');
        if ($userinfo) {
            $paths[] = new restore_path_element('completiondata', '/activity/flexbook/completiondata/completion');
            $paths[] = new restore_path_element('logdata', '/activity/flexbook/logdata/log');
        }

        // Return the paths wrapped into standard activity structure.
        return $this->prepare_activity_structure($paths);
    }

    /**
     * Process a flexbook restore
     *
     * @param array $data
     * @return void
     */
    protected function process_flexbook($data) {
        global $DB;

        $data = (object)$data;
        $oldid = $data->id;
        $data->course = $this->get_courseid();

        // Insert the flexbook record.
        $newitemid = $DB->insert_record('flexbook', $data);
        // Immediately after inserting "activity" record, call this.
        $this->apply_activity_instance($newitemid);
    }

    /**
     * Process a annotationitem restore
     *
     * @param array $data
     * @return void
     */
    protected function process_annotationitems($data) {
        global $DB;

        $data = (object)$data;
        $oldid = $data->id;
        $oldcourseid = $data->courseid;
        $data->timecreated = time();
        $data->timemodified = time();
        $data->courseid = $this->get_courseid();
        $data->cmid = $this->task->get_moduleid();
        $data->annotationid = $this->get_new_parentid('flexbook');
        $data->contextid = $this->task->get_contextid();
        // Let's deal with content bank content. If contentid is not null or not yet added to the mapping, we need to add it.
        if ($data->contentid) {
            $filecontenthash = $data->cbfilecontenthash;
            // Check if the file already exist in this context (e.g. restore by content bank restore process when course is copied).
            $file = $DB->get_record(
                'files',
                [
                    'contenthash' => $filecontenthash,
                    'contextid' => context_course::instance($this->get_courseid())->id,
                    'component' => 'contentbank',
                    'filearea' => 'public',
                ],
                'itemid'
            );
            if ($file) {
                $data->contentid = $file->itemid;
            } else {
                // Interactions might use the same content bank content, so we don't want to restore it twice.
                $exist = $this->get_mappingid('cbcontent', $data->contentid);
                if ($exist) {
                    $data->contentid = $exist;
                } else {
                    if (($oldcourseid != $this->get_courseid() || !$this->task->is_samesite()) && isset($data->cbname)) {
                        $cbdata = new stdClass();
                        $cbdata->usercreated = $this->get_mappingid('user', $data->cbusercreated);
                        $cbdata->usermodified = $this->get_mappingid('user', $data->cbusermodified);
                        $cbdata->contextid = context_course::instance($this->get_courseid())->id;
                        $cbdata->instanceid = $data->cbinstanceid;
                        $cbdata->configdata = $data->cbconfigdata;
                        $cbdata->contenttype = $data->cbcontenttype ?? 'contenttype_h5p';
                        $cbdata->timecreated = time();
                        $cbdata->timemodified = time();
                        $cbdata->name = $data->cbname;
                        $newcontentid = $DB->insert_record('contentbank_content', $cbdata);
                        $this->set_mapping('cbcontent', $data->contentid, $newcontentid, true, $data->cbcontextid);
                        $data->contentid = $newcontentid;

                        // Note to older self, add_related_files means the process will go through the files.xml
                        // in the backup file and restore the files that match the params provided.
                        $this->add_related_files('contentbank', 'public', 'cbcontent', $data->cbcontextid);
                    }
                }
            }
        }
        $newitemid = $DB->insert_record('flexbook_items', $data);
        $this->set_mapping('annotationitems', $oldid, $newitemid, true);
    }

    /**
     * Process a completion data restore
     *
     * @param array $data
     * @return void
     */
    protected function process_completiondata($data) {
        global $DB;
        $data = (object)$data;
        $oldid = $data->id;
        $data->cmid = $this->get_new_parentid('flexbook');
        $data->userid = $this->get_mappingid('user', $data->userid);

        $oldcompletionitems = json_decode($data->completeditems, true);
        if (is_array($oldcompletionitems)) {
            $newcompletionitems = [];
            foreach ($oldcompletionitems as $olditemid) {
                $newitemid = $this->get_mappingid('annotationitems', $olditemid);
                if ($newitemid) {
                    $newcompletionitems[] = strval($newitemid);
                }
            }
            $data->completeditems = json_encode($newcompletionitems);
        }

        $oldcompletiondetails = json_decode($data->completiondetails, true);
        if (is_array($oldcompletiondetails)) {
            $newcompletiondetails = [];
            foreach ($oldcompletiondetails as $olditemid => $cdetails) {
                if (is_string($cdetails)) {
                    $cdetails = json_decode($cdetails);
                } else {
                    $cdetails = (object)$cdetails;
                }
                $newitemid = $this->get_mappingid('annotationitems', $cdetails->id);
                if ($newitemid) {
                    $cdetails->id = $newitemid;
                    $newcompletiondetails[] = json_encode($cdetails);
                }
            }
            $data->completiondetails = json_encode($newcompletiondetails);
        }

        if (!empty($data->lastviewed) && $data->lastviewed != '999') {
            $mappedlastviewed = $this->get_mappingid('annotationitems', $data->lastviewed);
            if ($mappedlastviewed) {
                $data->lastviewed = $mappedlastviewed;
            }
        }

        $olddetails = json_decode($data->details, true);
        if (is_array($olddetails)) {
            if (isset($olddetails['timespent']) && is_array($olddetails['timespent'])) {
                $newtimespent = [];
                foreach ($olddetails['timespent'] as $olditemid => $time) {
                    if ($olditemid == '999') {
                        $newtimespent[$olditemid] = $time;
                        continue;
                    }
                    $newitemid = $this->get_mappingid('annotationitems', $olditemid);
                    if ($newitemid) {
                        $newtimespent[$newitemid] = $time;
                    }
                }
                $olddetails['timespent'] = $newtimespent;
            }
            if (isset($olddetails['views']) && is_array($olddetails['views'])) {
                $newviews = [];
                foreach ($olddetails['views'] as $olditemid => $view) {
                    if ($olditemid == '999') {
                        $newviews[$olditemid] = $view;
                        continue;
                    }
                    $newitemid = $this->get_mappingid('annotationitems', $olditemid);
                    if ($newitemid) {
                        $newviews[$newitemid] = $view;
                    }
                }
                $olddetails['views'] = $newviews;
            }
            $data->details = json_encode($olddetails);
        }

        $newitemid = $DB->insert_record('flexbook_completion', $data);
        $this->set_mapping('completiondata', $oldid, $newitemid);
    }

    /**
     * Process a log data restore
     *
     * @param mixed $data
     * @return void
     */
    protected function process_logdata($data) {
        global $DB;

        $data = (object)$data;
        $oldid = $data->id;
        $data->cmid = $this->get_new_parentid('flexbook');
        $data->userid = $this->get_mappingid('user', $data->userid);
        $data->annotationid = $this->get_mappingid('annotationitems', $data->annotationid);
        $oldcompletionid = $data->completionid;
        $data->completionid = $this->get_mappingid('completiondata', $oldcompletionid);

        // Decode @@ANNOID=xxx@@ in text fields.
        $data->text1 = $data->text1 ? $this->decode_text($data->text1) : $data->text1;
        $data->text2 = $data->text2 ? $this->decode_text($data->text2) : $data->text2;
        $data->text3 = $data->text3 ? $this->decode_text($data->text3) : $data->text3;
        $newitemid = $DB->insert_record('flexbook_log', $data);
        $this->set_mapping('logdata', $oldid, $newitemid, true);
    }

    /**
     * Decodes the given text.
     *
     * @param string $text The text to be decoded.
     * @return string The decoded text.
     */
    protected function decode_text($text) {
        // Annotation id.
        $search = '/@@ANNOID#([0-9]+)/';
        $text = preg_replace_callback($search, function ($matches) {
            return '@@ANNOID#' . $this->get_mappingid('annotationitems', $matches[1]);
        }, $text);
        // Interactive video instance id.
        $search = '/@@INSTANCEID#([0-9]+)/';
        $text = preg_replace_callback($search, function ($matches) {
            return '@@INSTANCEID#' . $this->get_mappingid('flexbook', $matches[1]);
        }, $text);
        // Course module id.
        $search = '/@@CMID#([0-9]+)/';
        $text = preg_replace_callback($search, function ($matches) {
            return '@@CMID#' . $this->get_mappingid('course_module', $matches[1]);
        }, $text);
        // Course id.
        $search = '/@@COURSEID#([0-9]+)/';
        $text = preg_replace_callback($search, function ($matches) {
            return '@@COURSEID#' . $this->get_mappingid('course', $matches[1]);
        }, $text);
        // User id.
        $search = '/@@UID#([0-9]+)/';
        $text = preg_replace_callback($search, function ($matches) {
            return '@@UID#' . $this->get_mappingid('user', $matches[1]);
        }, $text);
        // Log id.
        $search = '/@@LOGID#([0-9]+)/';
        $text = preg_replace_callback($search, function ($matches) {
            return '@@LOGID#' . $this->get_mappingid('logdata', $matches[1]);
        }, $text);

        return $text;
    }

    /**
     * Actions to be executed after the restore is completed
     */
    protected function after_execute() {
        global $DB;

        // Re-map the sequence field.
        $flexbookid = $this->get_new_parentid('flexbook');
        if ($flexbook = $DB->get_record('flexbook', ['id' => $flexbookid])) {
            $sequence = $flexbook->sequence;
            if (!empty($sequence)) {
                $oldids = explode(',', $sequence);
                $newids = [];
                foreach ($oldids as $oldid) {
                    $newid = $this->get_mappingid('annotationitems', $oldid);
                    if ($newid) {
                        $newids[] = $newid;
                    }
                }
                $flexbook->sequence = implode(',', $newids);
                $DB->update_record('flexbook', $flexbook);
            }
        }

        // Add flexbook related files, no need to match by itemname (just internally handled context).
        $this->add_related_files('mod_flexbook', 'intro', null);
        $this->add_related_files('mod_flexbook', 'endscreentext', null);
        $this->add_related_files('mod_flexbook', 'content', 'annotationitems');
        $this->add_related_files('mod_flexbook', 'itext1', 'annotationitems');
        $this->add_related_files('mod_flexbook', 'itext2', 'annotationitems');
        $this->add_related_files('mod_flexbook', 'itext3', 'annotationitems');
        $this->add_related_files('mod_flexbook', 'text1', 'logdata');
        $this->add_related_files('mod_flexbook', 'text2', 'logdata');
        $this->add_related_files('mod_flexbook', 'text3', 'logdata');
        $this->add_related_files('mod_flexbook', 'attachments', 'logdata');
    }
}
