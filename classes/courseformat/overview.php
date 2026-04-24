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

namespace mod_flexbook\courseformat;

use cm_info;
use cache;
use core\output\action_link;
use core\output\local\properties\text_align;
use core_courseformat\local\overview\overviewitem;
use moodle_url;

/**
 * Flexbook overview integration (for Moodle 5.1+)
 *
 * @package    mod_flexbook
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class overview extends \core_courseformat\activityoverviewbase {
    /** @var array The flexbook items. */
    private array $items;

    /** @var int The total number of students. */
    private int $allstudents;

    /** @var \core\output\renderer_helper The renderer helper. */
    protected $rendererhelper;

    /**
     * Constructor.
     *
     * @param \cm_info $cm the course module instance.
     * @param \core\output\renderer_helper $rendererhelper the renderer helper.
     */
    public function __construct(
        \cm_info $cm,
        \core\output\renderer_helper $rendererhelper
    ) {
        global $DB;
        parent::__construct($cm);
        $this->rendererhelper = $rendererhelper;
        $this->allstudents = count_enrolled_users($cm->context);

        $cache = \cache::make('mod_flexbook', 'fb_items');
        $items = $cache->get($cm->id);
        if (!$items) {
            $items = $DB->get_records(
                'flexbook_items',
                ['cmid' => $cm->id]
            );
            $items = array_values($items);
            $cache->set($cm->id, $items);
        }
        $this->items = $items ?: [];
    }

    #[\Override]
    public function get_actions_overview(): ?overviewitem {
        if (!has_capability('mod/flexbook:viewreport', $this->cm->context)) {
            return null;
        }

        $viewresults = get_string('fullreport', 'mod_flexbook');
        $reporturl = new moodle_url('/mod/flexbook/report.php', ['id' => $this->cm->id]);
        $content = new action_link(
            $reporturl,
            $viewresults,
            null,
            ['class' => 'btn btn-outline-secondary'],
        );

        return new overviewitem(
            get_string('actions', 'mod_flexbook'),
            '',
            $content,
            text_align::CENTER,
        );
    }

    #[\Override]
    public function get_extra_overview_items(): array {
        return [
            'interactions' => $this->get_extra_interactions(),
            'userxp' => $this->get_extra_user_xp(),
            'usercompletion' => $this->get_extra_user_completion(),
            'studentstarted' => $this->get_extra_students_started(),
            'studentcompleted' => $this->get_extra_students_completed(),
            'studentended' => $this->get_extra_students_ended(),
        ];
    }

    /**
     * Get the number of interactions for the given module instance.
     *
     * @return overviewitem|null An overview item or null if the user lacks the required capability.
     */
    private function get_extra_interactions(): ?overviewitem {
        if (has_capability('mod/flexbook:viewreport', $this->cm->context)) {
            return null;
        }

        return new overviewitem(
            get_string('interactions', 'mod_flexbook'),
            count($this->items),
            count($this->items),
        );
    }

    /**
     * Get the XP earned by the current user.
     *
     * @return overviewitem|null An overview item or null if the user lacks the required capability.
     */
    private function get_extra_user_xp(): ?overviewitem {
        if (has_capability('mod/flexbook:viewreport', $this->cm->context)) {
            return null;
        }

        global $DB, $USER;
        $xp = $DB->get_field_sql("SELECT c.xp FROM {flexbook_completion} c
                WHERE c.cmid = :cmid AND c.userid = :userid", ['cmid' => $this->cm->id, 'userid' => $USER->id]);

        if (empty($xp)) {
            return new overviewitem(
                get_string('xp', 'mod_flexbook'),
                '-',
                '-'
            );
        }

        return new overviewitem(
            get_string('xp', 'mod_flexbook'),
            $xp,
            $xp,
        );
    }

    /**
     * Get the completion percentage for the current user.
     *
     * @return overviewitem|null An overview item or null if the user lacks the required capability.
     */
    private function get_extra_user_completion(): ?overviewitem {
        if (has_capability('mod/flexbook:viewreport', $this->cm->context)) {
            return null;
        }

        global $DB, $USER;
        $completion = $DB->get_field_sql("SELECT c.completionpercentage FROM {flexbook_completion} c
                WHERE c.cmid = :cmid AND c.userid = :userid", ['cmid' => $this->cm->id, 'userid' => $USER->id]);

        if (empty($completion)) {
            return new overviewitem(
                get_string('completionpercentage', 'mod_flexbook'),
                '-',
                '-'
            );
        }

        return new overviewitem(
            get_string('completionpercentage', 'mod_flexbook'),
            $completion,
            $completion . '%',
        );
    }

    /**
     * Get the students started overview item.
     *
     * @return overviewitem|null An overview item or null if the user lacks the required capability.
     */
    private function get_extra_students_started(): ?overviewitem {
        if (!has_capability('mod/flexbook:viewreport', $this->cm->context)) {
            return null;
        }

        global $DB;

        $sql = "SELECT COUNT(DISTINCT c.userid) FROM {flexbook_completion} c
                WHERE c.cmid = :cmid AND c.timecreated > 0";
        $started = $DB->count_records_sql($sql, ['cmid' => $this->cm->id]);

        return new overviewitem(
            get_string('studentsstarted', 'mod_flexbook'),
            $started,
            $started . " / " . $this->allstudents,
        );
    }

    /**
     * Get the number of students who completed the activity.
     *
     * @return overviewitem|null An overview item or null if the user lacks the required capability.
     */
    private function get_extra_students_completed(): ?overviewitem {
        if (!has_capability('mod/flexbook:viewreport', $this->cm->context)) {
            return null;
        }

        if (count($this->items) == 0) {
            return new overviewitem(
                get_string('studentscompleted', 'mod_flexbook'),
                '-',
                '-'
            );
        }

        global $DB;
        $sql = "SELECT COUNT(DISTINCT c.userid) FROM {flexbook_completion} c
                WHERE c.cmid = :cmid AND c.timecompleted > 0";
        $completed = $DB->count_records_sql($sql, ['cmid' => $this->cm->id]);

        return new overviewitem(
            get_string('studentscompleted', 'mod_flexbook'),
            $completed,
            $completed . " / " . $this->allstudents,
        );
    }

    /**
     * Get the number of students who reached the end.
     *
     * @return overviewitem|null An overview item or null if the user lacks the required capability.
     */
    private function get_extra_students_ended(): ?overviewitem {
        if (!has_capability('mod/flexbook:viewreport', $this->cm->context)) {
            return null;
        }

        global $DB;
        $sql = "SELECT COUNT(DISTINCT c.userid) FROM {flexbook_completion} c
                WHERE c.cmid = :cmid AND c.timeended > 0";
        $ended = $DB->count_records_sql($sql, ['cmid' => $this->cm->id]);

        return new overviewitem(
            get_string('studentsended', 'mod_flexbook'),
            $ended,
            $ended . " / " . $this->allstudents,
        );
    }
}
