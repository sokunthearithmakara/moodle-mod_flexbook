Built with similar concepts and architecture as the Interactive Video plugin, Flexbook all

## Main Features: ##
- Distract-Free Mode: Display video/audio in a mode that maximizes focus.
- Completion Tracking: Track completion based on content type: manual, view, or automatic.
- Activity Completion: Set activity completion based on the percentage of interactions completed and/or when the user reaches the end of the content.
- Experience Points: Award participants experience points after each content/interaction completion.
- Detailed Reports: Access completion reports with details for each interaction.
- Mobile Support: Compatible with mobile apps both on Android and iOS.
- Modular Design: Administrators can add, remove, enable, or disable content types as plugins/subplugins. Developers can extend Flexbook through custom plugins.

## Out-of-the-box interaction/content types: ##
- Chapter: Break the book into chapters.
- Content bank item: Add content from the course's content bank.
- External content: Embed an external content using OEmbed library.
- Rich text: Text content using the text editor.

## Optional content types: ##
https://buymeacoffee.com/tsmakara

## Installing via uploaded ZIP file ##

1. Log in to your Moodle site as an admin and go to _Site administration >
   Plugins > Install plugins_.
2. Upload the ZIP file with the plugin code. You should only be prompted to add
   extra details if your plugin type is not automatically detected.
3. Check the plugin validation report and finish the installation.

## Installing manually ##

The plugin can be also installed by putting the contents of this directory to

    {your/moodle/dirroot}/mod/flexbook

Afterwards, log in to your Moodle site as an admin and go to _Site administration >
Notifications_ to complete the installation.

Alternatively, you can run

    $ php admin/cli/upgrade.php

to complete the installation from the command line.

## License ##

2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later
version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE.  See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with
this program.  If not, see <https://www.gnu.org/licenses/>.

This project is tested with BrowserStack