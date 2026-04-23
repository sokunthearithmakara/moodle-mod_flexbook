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
 * Provides all the settings and steps to perform one complete backup of the activity
 *
 * @package    mod_flexbook
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class backup_flexbook_activity_structure_step extends backup_activity_structure_step {
    /**
     * Backup structure
     */
    protected function define_structure() {

        global $DB;
        // To know if we are including userinfo.
        $userinfo = $this->get_setting_value('userinfo');

        $flexbook = new backup_nested_element('flexbook', ["id"], [
            'course',
            'name',
            'timecreated',
            'timemodified',
            'intro',
            'introformat',
            'type',
            'endscreentext',
            'displayasstartscreen',
            'completionpercentage',
            'grade',
            'displayoptions',
            'extendedcompletion',
            'sequence',
        ]);

        $items = new backup_nested_element('items');
        // Get the columns from the flexbook_items table.
        $columns = $DB->get_columns('flexbook_items');
        $columns = array_keys($columns);
        $columns = array_diff($columns, ['id']);
        $cbcolumns = [
            'cbname',
            'cbcontextid',
            'cbcontenttype',
            'cbinstanceid',
            'cbconfigdata',
            'cbusercreated',
            'cbusermodified',
            'cbtimecreated',
            'cbtimemodified',
            'cbfilecontenthash',
        ];
        $columns = array_merge($columns, $cbcolumns);
        $item = new backup_nested_element('item', ["id"], $columns);

        // Build the tree.
        $flexbook->add_child($items);
        $items->add_child($item);

        // Define sources.
        $flexbook->set_source_table('flexbook', ['id' => backup::VAR_ACTIVITYID]);
        $item->set_source_sql(
            'SELECT fi.*, cc.name as cbname, cc.contextid as cbcontextid,
            cc.contenttype as cbcontenttype, cc.instanceid as cbinstanceid, cc.configdata as cbconfigdata,
            cc.usercreated as cbusercreated, cc.usermodified as cbusermodified, cc.timecreated as cbtimecreated,
            cc.timemodified as cbtimemodified, f.contenthash as cbfilecontenthash
            FROM {flexbook_items} fi
            LEFT JOIN {contentbank_content} cc ON fi.contentid = cc.id
            LEFT JOIN {files} f ON fi.contentid = f.itemid AND f.component = \'contentbank\' AND f.filearea = \'public\'
            AND f.mimetype IS NOT NULL
            WHERE fi.annotationid = :annotationid
            ORDER BY fi.id ASC',
            ['annotationid' => backup::VAR_ACTIVITYID]
        );

        // Define id annotations.
        $item->annotate_ids('user', 'cbusercreated');
        $item->annotate_ids('user', 'cbusermodified');

        if ($userinfo) {
            // Completion data.
            $completiondata = new backup_nested_element('completiondata');
            $completion = new backup_nested_element('completion', ["id"], [
                "timecreated",
                "timecompleted",
                "timeended",
                "userid",
                "cmid",
                "courseid",
                "xp",
                "completeditems",
                "completionpercentage",
                "completiondetails",
                "lastviewed",
                "details",
            ]);

            $flexbook->add_child($completiondata);
            $completiondata->add_child($completion);
            $completion->set_source_table('flexbook_completion', ['cmid' => backup::VAR_ACTIVITYID], 'id ASC');

            // Define id annotations.
            $completion->annotate_ids('user', 'userid');

            // Log data.
            $logdata = new backup_nested_element('logdata');
            $logcolumns = $DB->get_columns('flexbook_log');
            $logcolumns = array_keys($logcolumns);
            $logcolumns = array_diff($logcolumns, ['id']);
            $log = new backup_nested_element('log', ["id"], $logcolumns);

            $flexbook->add_child($logdata);
            $logdata->add_child($log);
            $log->set_source_table('flexbook_log', ['cmid' => backup::VAR_ACTIVITYID], 'id ASC');

            // Define id annotations.
            $log->annotate_ids('user', 'userid');

            $log->annotate_files('mod_flexbook', 'attachments', 'id');
            $log->annotate_files('mod_flexbook', 'text1', 'id');
            $log->annotate_files('mod_flexbook', 'text2', 'id');
            $log->annotate_files('mod_flexbook', 'text3', 'id');
        }

        // Define file annotations.
        $flexbook->annotate_files('mod_flexbook', 'intro', null);
        $flexbook->annotate_files('mod_flexbook', 'endscreentext', null);

        $item->annotate_files('contentbank', 'public', 'contentid', context_course::instance($this->task->get_courseid())->id);
        $item->annotate_files('mod_flexbook', 'content', 'id');
        $item->annotate_files('mod_flexbook', 'itext1', 'id');
        $item->annotate_files('mod_flexbook', 'itext2', 'id');
        $item->annotate_files('mod_flexbook', 'itext3', 'id');

        // Return the root element (flexbook), wrapped into standard activity structure.
        return $this->prepare_activity_structure($flexbook);
    }
}
