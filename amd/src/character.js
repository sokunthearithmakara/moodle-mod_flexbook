/**
 * Mascot module for flexbook
 *
 * @module     mod_flexbook/character
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import $ from 'jquery';
import {get_string} from 'core/str';
import state from './state';

/**
 * Mascot class to handle animated characters
 */
class Mascot {
    /**
     * Initialize the mascot
     * @param {string} character The character name
     * @param {string} firstname User's first name
     * @param {boolean} isNew Whether this is a new attempt
     */
    static async init(character, firstname, isNew) {
        this.isRandomSelection = (character === 'random');
        if (this.isRandomSelection) {
            const available = ['duo', 'walle', 'panda', 'parrot', 'monkey'];
            character = available[Math.floor(Math.random() * available.length)];
        }
        this.character = character;
        this.firstname = firstname;
        this.isNew = isNew;

        await this.render();
        this.bindEvents();

        // Initial greeting after a short delay
        setTimeout(async() => {
            if ($('#fb-mascot-bubble').hasClass('show')) {
                return;
            }
            const stringKey = this.isNew ? 'mascot_hello' : 'mascot_welcomeback';
            const text = await get_string(stringKey, 'mod_flexbook', this.firstname);
            this.say(text);
        }, 1500);

        // Expose methods to state.
        state.say = this.say.bind(this);
        state.sayRandom = this.sayRandom.bind(this);
        state.hideSay = this.hideSay.bind(this);
        state.animate = this.animate.bind(this);
    }

    /**
     * Render the mascot to the DOM
     */
    static async render() {
        if ($('#fb-mascot').length) {
            return;
        }

        const svg = this.getSvg(this.character);
        const dismissLabel = await get_string('mascot_dismiss', 'mod_flexbook');

        this.$el = $(`
            <div id="fb-mascot" class="pop-in mascot-${this.character}">
                <button class="mascot-dismiss" title="${dismissLabel}" aria-label="${dismissLabel}">
                    <i class="fa fa-close"></i>
                </button>
                <div id="fb-mascot-bubble"></div>
                <div class="mascot-ground"></div>
                <div class="mascot-container">
                    ${svg}
                </div>
            </div>
        `);

        $('#wrapper').append(this.$el);
        this.$bubble = $('#fb-mascot-bubble');
        state.isMascotActive = true;
    }

    /**
     * Get the inline SVG for a character
     * @param {string} character
     * @returns {string}
     */
    static getSvg(character) {
        const svgs = {
            duo: `
                <svg width="100%" height="100%" viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg">
                    <!-- Top Feathers -->
                    <path d="M60 40 Q80 10 100 40 Q120 10 140 40" fill="none"
                          stroke="#558B2F" stroke-width="12" stroke-linecap="round" />

                    <!-- Body -->
                    <rect class="mascot-body" x="45" y="40" width="110" height="130" rx="55" fill="#7CB342" />
                    <circle cx="100" cy="125" r="45" fill="#C0CA33" opacity="0.9" />

                    <!-- Belly Details -->
                    <path d="M85 110 Q90 115 95 110 M105 110 Q110 115 115 110"
                          stroke="#558B2F" fill="none" stroke-width="2" opacity="0.5" />
                    <path d="M80 125 Q85 130 90 125 M100 125 Q105 130 110 125 M120 125 Q125 130 130 125"
                          stroke="#558B2F" fill="none" stroke-width="2" opacity="0.5" />

                    <!-- Wings (Animated) -->
                    <path class="mascot-wing mascot-wing-left" d="M45 80 Q25 100 45 150" fill="#689F38" />
                    <path class="mascot-wing mascot-wing-right" d="M155 80 Q175 100 155 150" fill="#689F38" />

                    <!-- Eyes -->
                    <g class="mascot-eyes">
                        <g class="mascot-eye">
                            <circle cx="70" cy="85" r="28" fill="white" />
                            <circle class="mascot-pupil" cx="70" cy="85" r="14" fill="black" />
                            <circle cx="76" cy="79" r="5" fill="white" opacity="0.8" />
                        </g>
                        <g class="mascot-eye">
                            <circle cx="130" cy="85" r="28" fill="white" />
                            <circle class="mascot-pupil" cx="130" cy="85" r="14" fill="black" />
                            <circle cx="136" cy="79" r="5" fill="white" opacity="0.8" />
                        </g>
                    </g>

                    <!-- Beak -->
                    <g class="mascot-beak">
                        <path d="M92 105 L100 125 L108 105 Z" fill="#FFA000" />
                        <path d="M92 105 Q100 102 108 105" fill="#FFC107" />
                    </g>

                    <!-- Feet -->
                    <g class="mascot-feet">
                        <circle cx="85" cy="175" r="8" fill="#FBC02D" />
                        <circle cx="115" cy="175" r="8" fill="#FBC02D" />
                    </g>
                </svg>
            `,
            walle: `
                <svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
                    <rect class="mascot-body" x="25" y="50" width="50" height="45" rx="5" fill="#f5b800" />
                    <rect x="30" y="55" width="40" height="35" rx="3" fill="#d4a017" />
                    <path d="M40 50 L40 40 L30 40 L30 25" fill="none" stroke="#666" stroke-width="4" />
                    <path d="M60 50 L60 40 L70 40 L70 25" fill="none" stroke="#666" stroke-width="4" />
                    <g class="mascot-eyes">
                        <g class="mascot-eye">
                            <ellipse cx="30" cy="30" rx="14" ry="12" fill="#999" />
                            <circle class="mascot-pupil" cx="30" cy="30" r="6" fill="black" />
                        </g>
                        <g class="mascot-eye">
                            <ellipse cx="70" cy="30" rx="14" ry="12" fill="#999" />
                            <circle class="mascot-pupil" cx="70" cy="30" r="6" fill="black" />
                        </g>
                    </g>
                    <path class="mascot-arm mascot-arm-left" d="M25 60 L10 65 L10 75"
                        fill="none" stroke="#666" stroke-width="5" stroke-linecap="round" />
                    <path class="mascot-arm mascot-arm-right" d="M75 60 L90 65 L90 75"
                        fill="none" stroke="#666" stroke-width="5" stroke-linecap="round" />
                    <g class="mascot-tracks">
                        <rect x="20" y="95" width="20" height="20" rx="5" fill="#333" />
                        <rect x="60" y="95" width="20" height="20" rx="5" fill="#333" />
                    </g>
                </svg>
            `,
            panda: `
                <svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
                    <g class="mascot-ears">
                        <circle cx="28" cy="25" r="12" fill="#333" />
                        <circle cx="72" cy="25" r="12" fill="#333" />
                    </g>
                    <rect class="mascot-body" x="30" y="70" width="40" height="40" rx="20"
                        fill="white" stroke="#333" stroke-width="2" />
                    <rect class="mascot-head" x="15" y="25" width="70" height="60" rx="30"
                        fill="white" stroke="#333" stroke-width="2" />
                    <path d="M45 25 Q50 18 55 25" fill="none" stroke="#333" stroke-width="2" />
                    <g class="mascot-patches">
                        <ellipse cx="32" cy="52" rx="13" ry="15" fill="#333" />
                        <ellipse cx="68" cy="52" rx="13" ry="15" fill="#333" />
                    </g>
                    <g class="mascot-eyes">
                        <circle class="mascot-pupil" cx="34" cy="52" r="5" fill="white" />
                        <circle class="mascot-pupil" cx="66" cy="52" r="5" fill="white" />
                        <circle cx="33" cy="50" r="2" fill="white" opacity="0.8" />
                        <circle cx="65" cy="50" r="2" fill="white" opacity="0.8" />
                    </g>
                    <g class="mascot-blush">
                        <ellipse cx="25" cy="65" rx="6" ry="4" fill="#ffb6c1" opacity="0.7" />
                        <ellipse cx="75" cy="65" rx="6" ry="4" fill="#ffb6c1" opacity="0.7" />
                    </g>
                    <g class="mascot-nose-mouth">
                        <path d="M46 65 Q50 68 54 65" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" />
                        <circle cx="50" cy="61" r="3" fill="black" />
                    </g>
                    <g class="mascot-bamboo">
                        <rect x="20" y="80" width="60" height="8" rx="4" fill="#58cc02" transform="rotate(-10 50 84)" />
                    </g>
                    <g class="mascot-arms">
                    <ellipse class="mascot-arm mascot-arm-left" cx="25" cy="85" rx="8" ry="12"
                        fill="#333" transform="rotate(-10 25 85)" />
                    <ellipse class="mascot-arm mascot-arm-right" cx="75" cy="82" rx="8" ry="12"
                        fill="#333" transform="rotate(10 75 82)" />
                    </g>
                </svg>
            `,
            parrot: `
                <svg width="100%" height="100%" viewBox="0 0 200 250" xmlns="http://www.w3.org/2000/svg">
                    <!-- Tail -->
                    <path d="M85 200 L100 245 L115 200" fill="#1B5E20" />
                    <path d="M92 200 L100 235 L108 200" fill="#2E7D32" />

                    <!-- Body -->
                    <ellipse class="mascot-body" cx="100" cy="130" rx="65" ry="85" fill="#43A047" />
                    <path d="M55 135 Q100 190 145 135 Q100 110 55 135" fill="#C0CA33" opacity="0.8" />

                    <!-- Crest (Animated) -->
                    <g class="mascot-crest">
                        <path d="M80 60 C 70 30, 95 10, 105 55" fill="#FFC107" />
                        <path d="M100 55 C 110 15, 135 35, 120 65" fill="#FF5722" />
                        <path d="M90 60 C 95 20, 115 20, 110 60" fill="#F44336" />
                    </g>

                    <!-- Wings (Animated) -->
                    <path class="mascot-wing mascot-wing-left"
                          d="M40 110 Q10 130 40 190 Q50 170 50 120 Z" fill="#E53935" />
                    <path class="mascot-wing mascot-wing-right"
                          d="M160 110 Q190 130 160 190 Q150 170 150 120 Z" fill="#E53935" />

                    <!-- Eyes -->
                    <g class="mascot-eyes">
                        <g class="mascot-eye">
                            <circle cx="72" cy="90" r="20" fill="white" />
                            <circle class="mascot-pupil" cx="72" cy="90" r="10" fill="black" />
                            <circle cx="76" cy="86" r="4" fill="white" opacity="0.8" />
                        </g>
                        <g class="mascot-eye">
                            <circle cx="128" cy="90" r="20" fill="white" />
                            <circle class="mascot-pupil" cx="128" cy="90" r="10" fill="black" />
                            <circle cx="132" cy="86" r="4" fill="white" opacity="0.8" />
                        </g>
                    </g>

                    <!-- Beak -->
                    <g class="mascot-beak">
                        <path d="M85 105 Q100 95 115 105 Q110 155 100 155 Q90 155 85 105" fill="#37474F" />
                        <path d="M92 115 Q100 110 108 115 L100 135 Z" fill="#263238" />
                    </g>

                    <!-- Feet -->
                    <g class="mascot-feet">
                        <rect x="82" y="210" width="10" height="15" rx="5" fill="#FFA000" />
                        <rect x="108" y="210" width="10" height="15" rx="5" fill="#FFA000" />
                    </g>
                </svg>
            `,
            monkey: `
                <svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
                    <!-- Tail (Animated) - Compact outward curl -->
                    <path class="mascot-tail" d="M60 85 Q70 85 75 80 Q80 75 75 70 Q70 65 65 70 Q62 75 68 75"
                        fill="none" stroke="#5d4037" stroke-width="6" stroke-linecap="round" />

                    <!-- Ears -->
                    <g class="mascot-ears">
                        <circle cx="25" cy="35" r="13" fill="#8d6e63" />
                        <circle cx="25" cy="35" r="7" fill="#d7ccc8" />
                        <circle cx="75" cy="35" r="13" fill="#8d6e63" />
                        <circle cx="75" cy="35" r="7" fill="#d7ccc8" />
                    </g>

                    <!-- Small Egg-shaped Body -->
                    <path class="mascot-body" d="M34 70 C34 50 42 45 50 45 C58 45 66 50 66 70
                                             C66 85 60 95 50 95 C40 95 34 85 34 70 Z" fill="#8d6e63" />
                    <!-- Egg-shaped belly patch -->
                    <path d="M40 75 C40 62 45 58 50 58 C55 58 60 62 60 75 C60 85 55 90 50 90 C45 90 40 85 40 75 Z" fill="#d7ccc8" />

                    <!-- Head -->
                    <circle class="mascot-head" cx="50" cy="32" r="30" fill="#8d6e63" />
                    <!-- Three-circle face patch -->
                    <g class="mascot-face-patch">
                        <circle cx="40" cy="30" r="16" fill="#d7ccc8" />
                        <circle cx="60" cy="30" r="16" fill="#d7ccc8" />
                        <ellipse cx="50" cy="48" rx="22" ry="16" fill="#d7ccc8" />
                    </g>

                    <!-- Eyes -->
                    <g class="mascot-eyes">
                        <g class="mascot-eye">
                            <circle cx="40" cy="32" r="7" fill="white" />
                            <circle class="mascot-pupil" cx="40" cy="32" r="3.5" fill="black" />
                            <circle cx="39" cy="30.5" r="1.5" fill="white" opacity="0.8" />
                        </g>
                        <g class="mascot-eye">
                            <circle cx="60" cy="32" r="7" fill="white" />
                            <circle class="mascot-pupil" cx="60" cy="32" r="3.5" fill="black" />
                            <circle cx="59" cy="30.5" r="1.5" fill="white" opacity="0.8" />
                        </g>
                        <!-- Eyebrows -->
                        <path d="M35 22 Q40 19 45 22" fill="none" stroke="#5d4037" stroke-width="2" stroke-linecap="round" />
                        <path d="M55 22 Q60 19 65 22" fill="none" stroke="#5d4037" stroke-width="2" stroke-linecap="round" />
                    </g>

                    <!-- Nose and Mouth -->
                    <g class="mascot-nose">
                        <path d="M47 42 Q50 39 53 42" fill="none" stroke="#5d4037" stroke-width="2" stroke-linecap="round" />
                        <circle cx="48" cy="43" r="0.8" fill="#5d4037" />
                        <circle cx="52" cy="43" r="0.8" fill="#5d4037" />
                    </g>
                    <g class="mascot-mouth">
                        <path d="M38 48 Q50 60 62 48" fill="none" stroke="#5d4037" stroke-width="2" stroke-linecap="round" />
                        <path d="M44 53 Q50 58 56 53 Q50 56 44 53" fill="#ff8a80" />
                    </g>

                    <!-- Arms -->
                    <path class="mascot-arm mascot-arm-left" d="M34 65 Q22 70 27 85"
                        fill="none" stroke="#8d6e63" stroke-width="6" stroke-linecap="round" />
                    <path class="mascot-arm mascot-arm-right" d="M66 65 Q78 70 73 85"
                        fill="none" stroke="#8d6e63" stroke-width="6" stroke-linecap="round" />

                    <!-- Long Legs and Feet -->
                    <g class="mascot-feet">
                        <!-- Leg Stems -->
                        <line x1="44" y1="90" x2="44" y2="110" stroke="#8d6e63" stroke-width="5" stroke-linecap="round" />
                        <line x1="56" y1="90" x2="56" y2="110" stroke="#8d6e63" stroke-width="5" stroke-linecap="round" />
                        <!-- Feet -->
                        <rect x="38" y="110" width="12" height="6" rx="3" fill="#8d6e63" />
                        <rect x="50" y="110" width="12" height="6" rx="3" fill="#8d6e63" />
                    </g>
                </svg>
            `
        };
        return svgs[character] || '';
    }

    /**
     * Bind events to the mascot
     */
    static bindEvents() {
        this.$el.find('.mascot-container').on('click', async() => {
            this.animate('jump');
            await this.sayRandom('yay');
        });

        this.$el.find('.mascot-container').on('dblclick', async() => {
            if (!this.isRandomSelection) {
                return;
            }
            const available = ['duo', 'walle', 'panda', 'parrot', 'monkey'];
            let index = available.indexOf(this.character);
            index = (index + 1) % available.length;
            this.character = available[index];

            // Update the mascot in place.
            const svg = this.getSvg(this.character);
            this.$el.find('.mascot-container').html(svg);
            this.$el.attr('class', 'mascot-' + this.character + ' anim-jump');

            this.say('Hi!');
        });

        this.$el.find('.mascot-dismiss').on('click', (e) => {
            e.stopPropagation();
            this.destroy();
        });

        // Interaction completed or XP updated
        this.onCompletionUpdated = async(e) => {
            const data = e.detail || (e.originalEvent && e.originalEvent.detail);
            if (!data) {
                return;
            }

            const earned = (data.target && data.target.earned) ? data.target.earned : 0;

            if (earned > 0) {
                // Prioritize XP celebration.
                this.animate('celebrate');
                this.say('⭐ +' + earned + ' XP!');
            } else if (earned < 0) {
                this.animate('sad');
                const oops = await get_string('mascot_oops', 'mod_flexbook');
                this.say(oops);
            } else if (data.action === 'mark-done') {
                // Fallback to generic happy reaction if no XP change.
                this.animate('happy');
                await this.sayRandom('happy');
            }
        };
        $(document).on('completionupdated.fb_mascot', this.onCompletionUpdated);
        $(document).on('xpupdated.fb_mascot', this.onCompletionUpdated); // Just in case XP is updated separately.

        // Reached end screen
        this.onReachedEnd = async() => {
            this.animate('cheer');
            await this.sayRandom('end');
        };
        $(document).on('fb:ended.fb_mascot', this.onReachedEnd);

        // Correct answer
        this.onCorrect = async(e) => {
            const data = e.detail || (e.originalEvent && e.originalEvent.detail);
            this.animate('happy');
            if (data && data.message) {
                this.say(data.message);
            } else {
                await this.sayRandom('correct');
            }
        };
        $(document).on('fb:correct.fb_mascot iv:correct.fb_mascot', this.onCorrect);

        // Incorrect answer
        this.onIncorrect = async(e) => {
            const data = e.detail || (e.originalEvent && e.originalEvent.detail);
            this.animate('sad');
            if (data && data.message) {
                this.say(data.message);
            } else {
                await this.sayRandom('incorrect');
            }
        };
        $(document).on('fb:incorrect.fb_mascot iv:incorrect.fb_mascot', this.onIncorrect);

        // Interaction complete
        this.onComplete = async(e) => {
            const data = e.detail || (e.originalEvent && e.originalEvent.detail);
            this.animate('cheer');
            if (data && data.message) {
                this.say(data.message);
            } else {
                await this.sayRandom('happy');
            }
        };
        $(document).on('iv:complete.fb_mascot', this.onComplete);
    }

    /**
     * Destroy the mascot and unbind events
     */
    static destroy() {
        $(document).off('.fb_mascot');

        if (this.$el) {
            this.$el.addClass('pop-out');
            setTimeout(() => {
                this.$el.remove();
                this.$el = null;
                state.isMascotActive = false;
                state.say = null;
                state.sayRandom = null;
                state.hideSay = null;
                state.animate = null;
            }, 500);
        }
    }

    /**
     * Play an animation
     * @param {string} type
     */
    static animate(type) {
        if (!this.$el) {
            return;
        }
        this.$el.removeClass('anim-jump anim-happy anim-celebrate anim-sad anim-cheer');
        void this.$el[0].offsetWidth; // Trigger reflow
        this.$el.addClass('anim-' + type);

        // Auto-stop animation after 3 seconds.
        if (this.animTimeout) {
            clearTimeout(this.animTimeout);
        }
        this.animTimeout = setTimeout(() => {
            if (this.$el) {
                this.$el.removeClass('anim-' + type);
            }
        }, 2000);

        // Play sounds based on animation type.
        if (type === 'happy' || type === 'celebrate' || type === 'cheer') {
            this.playSound('happy');
        } else if (type === 'jump') {
            this.playSound('speak');
        } else if (type === 'sad') {
            this.playSound('sad');
        }
    }

    /**
     * Play a sound effect using Web Audio API
     * @param {string} effect The effect name (happy, sad, speak)
     */
    static playSound(effect) {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.audioCtx.createGain();
            this.masterGain.gain.value = 0.5;
            this.masterGain.connect(this.audioCtx.destination);
        }

        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        const now = this.audioCtx.currentTime;

        switch (this.character) {
            case 'duo':
                this._playOwl(now, effect);
                break;
            case 'monkey':
                this._playMonkey(now, effect);
                break;
            case 'parrot':
                this._playParrot(now, effect);
                break;
            case 'walle':
                this._playRobot(now, effect);
                break;
            case 'panda':
                this._playPanda(now, effect);
                break;
        }
    }

    /**
     * Owl (Duo) sound synthesis
     * @param {number} t Start time
     * @param {string} effect
     */
    static _playOwl(t, effect) {
        const baseFreq = effect === 'happy' ? 380 : (effect === 'sad' ? 240 : 320);
        const hoo = (startTime, freq, dur) => {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            const lfo = this.audioCtx.createOscillator();
            const lfoGain = this.audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, startTime);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.9, startTime + dur);
            lfo.frequency.value = 5;
            lfoGain.gain.value = 10;
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
            osc.connect(gain);
            gain.connect(this.masterGain);
            lfo.start(startTime);
            osc.start(startTime);
            osc.stop(startTime + dur);
        };
        if (effect === 'happy') {
            hoo(t, baseFreq, 0.3);
            hoo(t + 0.35, baseFreq * 1.1, 0.4);
        } else if (effect === 'sad') {
            hoo(t, baseFreq, 0.6);
        } else {
            hoo(t, baseFreq, 0.25);
            hoo(t + 0.3, baseFreq, 0.25);
        }
    }

    /**
     * Monkey sound synthesis
     * @param {number} t Start time
     * @param {string} effect
     */
    static _playMonkey(t, effect) {
        const count = effect === 'happy' ? 4 : (effect === 'speak' ? 6 : 2);
        const freq = effect === 'sad' ? 600 : 1200;
        for (let i = 0; i < count; i++) {
            const start = t + (i * 0.15);
            const dur = 0.1;
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, start);
            osc.frequency.exponentialRampToValueAtTime(freq * 2.5, start + dur);
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.15, start + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(start);
            osc.stop(start + dur);
        }
    }

    /**
     * Parrot sound synthesis
     * @param {number} t Start time
     * @param {string} effect
     */
    static _playParrot(t, effect) {
        const chirp = (startTime, startFreq, endFreq, dur, volume = 0.2) => {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(startFreq, startTime);
            osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + dur);
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(startTime);
            osc.stop(startTime + dur + 0.05);
        };
        if (effect === 'happy') {
            chirp(t, 4000, 6500, 0.08);
            chirp(t + 0.1, 4500, 7000, 0.08);
        } else if (effect === 'sad') {
            chirp(t, 3500, 2000, 0.4, 0.15);
        } else {
            chirp(t, 5000, 6000, 0.05);
            chirp(t + 0.08, 5500, 4500, 0.05);
            chirp(t + 0.16, 6000, 7000, 0.07);
        }
    }

    /**
     * Robot (Walle) sound synthesis
     * @param {number} t Start time
     * @param {string} effect
     */
    static _playRobot(t, effect) {
        if (effect === 'speak') {
            for (let i = 0; i < 8; i++) {
                const start = t + (i * 0.08);
                const f = 800 + Math.random() * 1200;
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(f, start);
                gain.gain.setValueAtTime(0.15, start);
                gain.gain.exponentialRampToValueAtTime(0.001, start + 0.06);
                osc.connect(gain);
                gain.connect(this.masterGain);
                osc.start(start);
                osc.stop(start + 0.07);
            }
        } else {
            const duration = effect === 'sad' ? 0.8 : 0.25;
            const startF = effect === 'sad' ? 800 : 400;
            const endF = effect === 'sad' ? 50 : 1200;
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.type = effect === 'sad' ? 'square' : 'triangle';
            osc.frequency.setValueAtTime(startF, t);
            osc.frequency.exponentialRampToValueAtTime(endF, t + duration);
            gain.gain.setValueAtTime(0.2, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(t);
            osc.stop(t + duration);
        }
    }

    /**
     * Panda sound synthesis
     * @param {number} t Start time
     * @param {string} effect
     */
    static _playPanda(t, effect) {
        if (effect === 'happy') {
            // Panda Happy: Drum Roll
            const numHits = 12;
            const interval = 0.05;

            for (let i = 0; i < numHits; i++) {
                const start = t + (i * interval);
                const isLast = i === numHits - 1;
                const dur = isLast ? 0.2 : 0.04;
                const volume = isLast ? 0.4 : 0.2;

                const bufferSize = this.audioCtx.sampleRate * dur;
                const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let j = 0; j < bufferSize; j++) {
                    data[j] = Math.random() * 2 - 1;
                }

                const noiseSource = this.audioCtx.createBufferSource();
                noiseSource.buffer = buffer;

                const filter = this.audioCtx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.value = isLast ? 800 : 1200;
                filter.Q.value = 1.0;

                const gain = this.audioCtx.createGain();
                gain.gain.setValueAtTime(0, start);
                gain.gain.linearRampToValueAtTime(volume, start + 0.005);
                gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

                noiseSource.connect(filter);
                filter.connect(gain);
                gain.connect(this.masterGain);
                noiseSource.start(start);
                noiseSource.stop(start + dur);
            }
        } else if (effect === 'sad') {
            // Low whimper/groan: Deep frequency drop
            const dur = 0.8;
            const osc = this.audioCtx.createOscillator();
            const filter = this.audioCtx.createBiquadFilter();
            const gain = this.audioCtx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(110, t);
            osc.frequency.exponentialRampToValueAtTime(55, t + dur);

            filter.type = 'lowpass';
            filter.frequency.value = 250;

            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.2, t + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);
            osc.start(t);
            osc.stop(t + dur);
        } else {
            // Panda Talk: Pop
            const dur = 0.12;
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.type = 'sine';
            // Fast frequency sweep for a clean "pop" or "plop"
            osc.frequency.setValueAtTime(700, t);
            osc.frequency.exponentialRampToValueAtTime(40, t + dur);

            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.3, t + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(t);
            osc.stop(t + dur);
        }
    }

    /**
     * Display a speech bubble
     * @param {string} text
     * @param {number} duration Duration in ms. If 0, stays until cleared.
     * @param {string|null} id Optional interaction ID for tracking.
     */
    static say(text, duration = 3000, id = null) {
        if (!this.$el) {
            return;
        }
        this.playSound('speak');
        this.$bubble.html(`<span>${text}</span>`).addClass('show');

        if (duration === 0) {
            const $close = $('<button class="bubble-close"><i class="fa fa-close"></i></button>');
            $close.on('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                Mascot.hideSay();
                $(document).trigger('fb:instructiondismissed', {text: text, id: id});
            });
            this.$bubble.append($close);
        }

        if (this.bubbleTimeout) {
            clearTimeout(this.bubbleTimeout);
        }
        if (duration > 0) {
            this.bubbleTimeout = setTimeout(() => {
                this.hideSay();
            }, duration);
        }
    }

    /**
     * Hide the speech bubble
     */
    static hideSay() {
        if (!this.$el) {
            return;
        }
        this.$bubble.removeClass('show');
    }

    /**
     * Display a random message from a category
     * @param {string} category
     */
    static async sayRandom(category) {
        const index = Math.floor(Math.random() * 4) + 1;
        const text = await get_string(`mascot_${category}_${index}`, 'mod_flexbook', this.firstname);
        this.say(text);
    }
}

export default Mascot;
