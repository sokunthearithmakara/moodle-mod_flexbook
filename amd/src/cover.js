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
 * The flexbook cover's "Show more" for a long description, on the cover page and in the player's start screen.
 *
 * @module     mod_flexbook/cover
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

let listening = false;

/**
 * Offers "Show more" only when the description is longer than the space it is given.
 *
 * The check runs again whenever the description's box changes size: as images load, as the window is resized, and
 * when a cover that was hidden (the player's start screen) is shown.
 *
 * @param {HTMLElement} cover The cover.
 */
export const setUp = (cover) => {
    const clamp = cover?.querySelector('.fb-cover-clamp');
    const button = cover?.querySelector('[data-action="fbshowmore"]');
    if (!clamp || !button) {
        return;
    }
    const check = () => {
        if (!clamp.classList.contains('is-expanded') && clamp.clientHeight > 0) {
            button.hidden = clamp.scrollHeight <= clamp.clientHeight + 1;
        }
    };
    check();
    clamp.querySelectorAll('img').forEach((img) => img.addEventListener('load', check, {once: true}));
    if (window.ResizeObserver) {
        new ResizeObserver(check).observe(clamp);
    }
};

/**
 * Sets up every cover on the page, and the "Show more" and "Show less" buttons (once).
 */
export const init = () => {
    document.querySelectorAll('.fb-cover').forEach(setUp);
    if (listening) {
        return;
    }
    listening = true;
    document.addEventListener('click', (e) => {
        const button = e.target.closest('.fb-cover [data-action="fbshowmore"]');
        if (!button) {
            return;
        }
        e.preventDefault();
        const expanded = button.getAttribute('aria-expanded') !== 'true';
        button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        document.getElementById(button.getAttribute('aria-controls'))?.classList.toggle('is-expanded', expanded);
    });
};
