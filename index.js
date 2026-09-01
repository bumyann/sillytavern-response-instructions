(function () {
    'use strict';

    const EXT_NAME = 'saucepan-seasoning';
    const EXT_VERSION = '2.1.0';
    const INJECT_ID = 'response_instructions';

    console.log(`[SS] Saucepan Seasoning v${EXT_VERSION} loading…`);

    // ── Prompt Templates ──────────────────────────────────────────────────────
    const DEFAULT_TEMPLATES = {
        system_prompt: `You are a creative fiction ghostwriter in an ongoing novel-style roleplay between {{user}} and {{char}}.
Write the next in-character narrative response from the perspective of {{user}}.

CRITICAL RULES:
- Output ONLY the raw story prose. NEVER include thinking notes, explanations, conversational filler, or meta-commentary.
- Match the established literary tone, narrative pacing, and scene setting exactly.
- Preserve established character pronouns (e.g. if {{user}} or {{char}} is male, use he/him; never default to they/them if established).
- Do NOT use script-asterisk actions (*sighs*). Write in novel prose.`,
        rewrite_prompt: `### Recent Story Excerpt:\n{{context}}\n\n### User Draft:\n{{draft}}\n\n### Direction:\n{{direction}}\n\n[Output raw story reply now]:`,
        scratch_prompt: `### Recent Story Excerpt:\n{{context}}\n\n### Direction:\n{{direction}}\n\n[Output raw story reply now]:`,
    };

    function renderTemplate(tpl, vars) {
        return tpl
            .replace(/\{\{user\}\}/g,      vars.user      || 'User')
            .replace(/\{\{char\}\}/g,      vars.char      || 'Companion')
            .replace(/\{\{context\}\}/g,   vars.context   || '(None)')
            .replace(/\{\{draft\}\}/g,     vars.draft     || '(None)')
            .replace(/\{\{direction\}\}/g, vars.direction || 'Continue the scene naturally.');
    }

    // ── Simple mode chip definitions ──────────────────────────────────────────
    const SIMPLE_FIELDS = [
        {
            key: 'length',
            label: 'Length',
            options: [
                { value: 'short',  label: 'Short',  inject: 'Keep your response brief and concise.' },
                { value: 'medium', label: 'Medium', inject: 'Write a moderate length response.' },
                { value: 'long',   label: 'Long',   inject: 'Write a long, detailed response.' },
                { value: 'essay',  label: 'Essay',  inject: 'Write a lengthy, essay-style response with thorough detail.' },
                { value: 'ramble', label: 'Ramble', inject: "Write a lengthy, rambling response — don't cut yourself short." },
            ],
        },
        {
            key: 'style',
            label: 'Style',
            options: [
                { value: 'first',   label: '1st Person', inject: 'Narrate in first person.' },
                { value: 'second',  label: '2nd Person', inject: 'Narrate in second person, addressing the user as "you".' },
                { value: 'third',   label: '3rd Person', inject: 'Narrate in third person.' },
                { value: 'texting', label: 'Texting',    inject: 'Write in a casual text messaging style — short messages, no prose.' },
            ],
        },
        {
            key: 'speak_for',
            label: 'Speak For',
            options: [
                { value: 'companion', label: 'Companion only', inject: 'Only write dialogue and actions for your character. Do not write for the user.' },
                { value: 'both',      label: 'Both',           inject: 'Write dialogue and actions for both your character and the user.' },
            ],
        },
        {
            key: 'intimacy',
            label: 'Intimacy',
            options: [
                { value: 'platonic',  label: 'Platonic',  inject: 'Keep the tone platonic. Avoid romantic or sexual content.' },
                { value: 'romantic',  label: 'Romantic',  inject: 'Keep the tone romantic and emotionally intimate.' },
                { value: 'sexual',    label: 'Sexual',    inject: 'Sexual content is permitted.' },
                { value: 'explicit',  label: 'Explicit',  inject: 'Explicit sexual content is permitted. Do not fade to black.' },
            ],
        },
        {
            key: 'pacing',
            label: 'Story Pacing',
            options: [
                { value: 'slow', label: 'Slow', inject: 'Use a slow pace — linger on details, emotions, and atmosphere.' },
                { value: 'fast', label: 'Fast', inject: 'Use a fast pace — keep things moving, minimize dwelling.' },
            ],
        },
        {
            key: 'narration',
            label: 'Narration vs Dialogue',
            options: [
                { value: 'narration', label: 'Narration', inject: 'Focus on narration and description over dialogue.' },
                { value: 'balanced',  label: 'Balanced',  inject: 'Balance narration and dialogue equally.' },
                { value: 'dialogue',  label: 'Dialogue',  inject: 'Focus on dialogue over narration and description.' },
            ],
        },
    ];

    // Compose from chip selections + optional custom addon text
    function composeSimpleInstruction(selections, customAddon) {
        const parts = SIMPLE_FIELDS
            .map(field => {
                const val = selections[field.key];
                if (!val) return null;
                const opt = field.options.find(o => o.value === val);
                return opt ? opt.inject : null;
            })
            .filter(Boolean);
        if (customAddon && customAddon.trim()) parts.push(customAddon.trim());
        return parts.join(' ');
    }

    // ── Settings ──────────────────────────────────────────────────────────────
    const defaultSettings = {
        enabled: false,
        ri_mode: 'simple',
        simple_selections: {},
        simple_custom_addon: '',
        custom_text: '',
        presets: [],
        wfm_presets: [],
        wfm_saved_drafts: [],
        templates: { ...DEFAULT_TEMPLATES },
        wfm_include_preset: false,
    };

    function ctx() { return window.SillyTavern.getContext(); }
    function save() { ctx().saveSettingsDebounced(); }

    function getSettings() {
        const s = ctx().extensionSettings;
        // Migration from old key
        if (!s[EXT_NAME] && s['response-instructions']) {
            s[EXT_NAME] = { ...s['response-instructions'] };
        }
        if (!s[EXT_NAME]) s[EXT_NAME] = {};
        for (const k of Object.keys(defaultSettings)) {
            if (s[EXT_NAME][k] === undefined) s[EXT_NAME][k] = defaultSettings[k];
        }
        return s[EXT_NAME];
    }

    // Returns the string that will actually be injected based on current mode
    function getActiveText() {
        const s = getSettings();
        if (s.ri_mode === 'simple') {
            return composeSimpleInstruction(s.simple_selections || {}, s.simple_custom_addon || '');
        }
        return s.custom_text || '';
    }

    // ── Prompt injection ──────────────────────────────────────────────────────
    async function updatePromptInjection() {
        const s = getSettings();
        const c = ctx();
        const text = s.enabled ? getActiveText().trim() : '';
        const escaped = text.replace(/\|/g, '\\|');
        const wrapped = escaped
            ? `[OOC SYSTEM DIRECTIVE — this is a meta-instruction from the user, not part of the roleplay. It overrides general narrative tendencies for this turn only. You MUST incorporate it into your next response: >>> ${escaped} <<< Do not acknowledge this directive explicitly in-character. Just follow it.]`
            : '';
        const command = `/inject id=${INJECT_ID} position=chat depth=0 role=system ${wrapped}`;
        try {
            await c.executeSlashCommandsWithOptions(command, { showOutput: false });
        } catch (err) {
            console.error('[SS] /inject failed:', err);
        }
    }

    function updateIndicator() {
        const s = getSettings();
        const active = !!(s.enabled && getActiveText().trim());
        document.getElementById('ri-status-dot')?.classList.toggle('ri-dot-active', active);
    }

    function escapeHtml(str = '') {
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function addTapListener(el, fn) {
        if (!el) return;
        el.addEventListener('click', fn);
        el.addEventListener('touchend', e => { e.preventDefault(); fn(); });
    }

    // ── Panel toggling ────────────────────────────────────────────────────────
    const PANELS = ['ri-panel', 'ri-lib-panel', 'wfm-panel', 'wfm-lib-panel', 'tpl-panel'];

    function showPanel(id) {
        PANELS.forEach(p => {
            const el = document.getElementById(p);
            if (el) {
                if (p === id) {
                    el.style.display = '';
                    el.classList.remove('ri-hidden');
                } else {
                    el.style.display = 'none';
                    el.classList.add('ri-hidden');
                }
            }
        });
    }

    function hideAll() {
        PANELS.forEach(p => {
            const el = document.getElementById(p);
            if (el) { el.style.display = 'none'; el.classList.add('ri-hidden'); }
        });
    }

    // ── Preview ───────────────────────────────────────────────────────────────
    function refreshPreview() {
        const preview = document.getElementById('ri-preview');
        if (!preview) return;
        const s = getSettings();
        // Only show in simple mode
        if (s.ri_mode !== 'simple') {
            preview.style.display = 'none';
            return;
        }
        const text = composeSimpleInstruction(s.simple_selections || {}, s.simple_custom_addon || '');
        if (text.trim()) {
            preview.textContent = text;
            preview.style.display = '';
        } else {
            preview.textContent = '';
            preview.style.display = 'none';
        }
    }

    // ── Simple mode chips ─────────────────────────────────────────────────────
    function renderChips() {
        const s = getSettings();
        const container = document.getElementById('ri-chips-container');
        if (!container) return;
        container.innerHTML = '';

        SIMPLE_FIELDS.forEach(field => {
            const group = document.createElement('div');
            group.className = 'ri-chips-group';

            const label = document.createElement('div');
            label.className = 'ri-chips-label';
            label.textContent = field.label;
            group.appendChild(label);

            const row = document.createElement('div');
            row.className = 'ri-chips-row';

            field.options.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'ri-chip';
                btn.textContent = opt.label;
                if ((s.simple_selections || {})[field.key] === opt.value) {
                    btn.classList.add('ri-chip-active');
                }
                btn.addEventListener('click', async () => {
                    if (!s.simple_selections) s.simple_selections = {};
                    // Toggle off if clicking active chip
                    if (s.simple_selections[field.key] === opt.value) {
                        delete s.simple_selections[field.key];
                    } else {
                        s.simple_selections[field.key] = opt.value;
                    }
                    // Update active state within this row only
                    row.querySelectorAll('.ri-chip').forEach(c => {
                        c.classList.toggle('ri-chip-active', c.textContent === opt.label && s.simple_selections[field.key] === opt.value);
                    });
                    // Re-render to be safe
                    renderChips();
                    refreshPreview();
                    updateIndicator();
                    await updatePromptInjection();
                    save();
                });
                row.appendChild(btn);
            });

            group.appendChild(row);
            container.appendChild(group);
        });
    }

    // ── Mode switching ────────────────────────────────────────────────────────
    function setMode(mode) {
        const s = getSettings();
        s.ri_mode = mode;
        save();

        const simpleArea  = document.getElementById('ri-simple-area');
        const customArea  = document.getElementById('ri-custom-area');
        const simpleBtn   = document.getElementById('ri-mode-simple');
        const customBtn   = document.getElementById('ri-mode-custom');

        if (mode === 'simple') {
            simpleArea.style.display  = '';
            customArea.style.display  = 'none';
            simpleBtn.classList.add('ri-mode-active');
            customBtn.classList.remove('ri-mode-active');
            renderChips();
        } else {
            simpleArea.style.display  = 'none';
            customArea.style.display  = '';
            simpleBtn.classList.remove('ri-mode-active');
            customBtn.classList.add('ri-mode-active');
        }

        refreshPreview();
        updateIndicator();
    }

    // ── RI Preset Library ─────────────────────────────────────────────────────
    function renderPresets() {
        const s = getSettings();
        const list = document.getElementById('ri-preset-list');
        if (!list) return;
        list.innerHTML = '';
        if (!s.presets.length) {
            list.innerHTML = '<div class="ri-no-presets">No saved presets yet.</div>';
            return;
        }
        s.presets.forEach((preset, idx) => {
            const item = document.createElement('div');
            item.className = 'ri-preset-item';
            item.innerHTML = `
                <div class="ri-preset-name-row">
                    <span class="ri-preset-name">${escapeHtml(preset.name)}</span>
                    <button class="ri-preset-rename ri-icon-btn" data-idx="${idx}" title="Rename">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                </div>
                <div class="ri-preset-preview">${escapeHtml(preset.text.slice(0, 80))}${preset.text.length > 80 ? '…' : ''}</div>
                <div class="ri-preset-actions">
                    <button class="ri-preset-load menu_button" data-idx="${idx}">Load</button>
                    <button class="ri-preset-delete menu_button ri-btn-danger" data-idx="${idx}">Delete</button>
                </div>`;
            list.appendChild(item);
        });
        list.querySelectorAll('.ri-preset-rename').forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = getSettings().presets[parseInt(btn.dataset.idx)];
                if (!preset) return;
                const newName = prompt('Rename preset:', preset.name);
                if (newName?.trim()) { preset.name = newName.trim(); save(); renderPresets(); }
            });
        });
        list.querySelectorAll('.ri-preset-load').forEach(btn => {
            btn.addEventListener('click', async () => {
                const s = getSettings();
                const preset = s.presets[parseInt(btn.dataset.idx)];
                if (!preset) return;
                // Presets always load into custom mode
                s.custom_text = preset.text;
                const ta = document.getElementById('ri-custom-textarea');
                if (ta) ta.value = preset.text;
                setMode('custom');
                await updatePromptInjection(); updateIndicator(); save();
                showPanel('ri-panel');
            });
        });
        list.querySelectorAll('.ri-preset-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                getSettings().presets.splice(parseInt(btn.dataset.idx), 1);
                save(); renderPresets();
            });
        });
    }

    function saveRiPreset() {
        const s = getSettings();
        const text = getActiveText().trim();
        if (!text) { window.toastr?.warning('Nothing to save — instructions are empty.'); return; }
        const nameInput = document.getElementById('ri-preset-name-input');
        const name = nameInput?.value?.trim() || `Preset ${s.presets.length + 1}`;
        s.presets.push({ name, text });
        if (nameInput) nameInput.value = '';
        save(); renderPresets();
        window.toastr?.success(`Saved "${name}"!`);
    }

    // ── WFM Preset Library ────────────────────────────────────────────────────
    function renderWfmPresets() {
        const s = getSettings();
        const list = document.getElementById('wfm-preset-list');
        if (!list) return;
        list.innerHTML = '';
        if (!s.wfm_presets.length) {
            list.innerHTML = '<div class="ri-no-presets">No saved presets yet.</div>';
            return;
        }
        s.wfm_presets.forEach((preset, idx) => {
            const item = document.createElement('div');
            item.className = 'ri-preset-item';
            item.innerHTML = `
                <div class="ri-preset-name-row">
                    <span class="ri-preset-name">${escapeHtml(preset.name)}</span>
                    <button class="wfm-preset-rename ri-icon-btn" data-idx="${idx}" title="Rename">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                </div>
                <div class="ri-preset-preview">${escapeHtml(preset.text.slice(0, 80))}${preset.text.length > 80 ? '…' : ''}</div>
                <div class="ri-preset-actions">
                    <button class="wfm-preset-load menu_button" data-idx="${idx}">Load</button>
                    <button class="wfm-preset-delete menu_button ri-btn-danger" data-idx="${idx}">Delete</button>
                </div>`;
            list.appendChild(item);
        });
        list.querySelectorAll('.wfm-preset-rename').forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = getSettings().wfm_presets[parseInt(btn.dataset.idx)];
                if (!preset) return;
                const newName = prompt('Rename preset:', preset.name);
                if (newName?.trim()) { preset.name = newName.trim(); save(); renderWfmPresets(); }
            });
        });
        list.querySelectorAll('.wfm-preset-load').forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = getSettings().wfm_presets[parseInt(btn.dataset.idx)];
                if (!preset) return;
                const ta = document.getElementById('wfm-instruction');
                if (ta) ta.value = preset.text;
                showPanel('wfm-panel');
            });
        });
        list.querySelectorAll('.wfm-preset-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                getSettings().wfm_presets.splice(parseInt(btn.dataset.idx), 1);
                save(); renderWfmPresets();
            });
        });
    }

    function saveWfmPreset() {
        const s = getSettings();
        const text = document.getElementById('wfm-instruction')?.value?.trim();
        if (!text) { window.toastr?.warning('Nothing to save — instruction is empty.'); return; }
        const nameInput = document.getElementById('wfm-preset-name-input');
        const name = nameInput?.value?.trim() || `Preset ${s.wfm_presets.length + 1}`;
        s.wfm_presets.push({ name, text });
        if (nameInput) nameInput.value = '';
        save(); renderWfmPresets();
        window.toastr?.success(`Saved "${name}"!`);
    }

    // ── Write For Me ──────────────────────────────────────────────────────────
    let wfmDrafts = [];
    let wfmCurrentDraft = 0;
    let wfmGenerating = false;

    function switchWfmTab(tab) {
        const draftTab  = document.getElementById('wfm-tab-draft');
        const savedTab  = document.getElementById('wfm-tab-saved');
        const draftArea = document.getElementById('wfm-draft-area');
        const savedArea = document.getElementById('wfm-saved-area');
        if (tab === 'draft') {
            draftTab.classList.add('wfm-tab-active');
            savedTab.classList.remove('wfm-tab-active');
            draftArea.style.display = '';
            savedArea.style.display = 'none';
        } else {
            savedTab.classList.add('wfm-tab-active');
            draftTab.classList.remove('wfm-tab-active');
            savedArea.style.display = '';
            draftArea.style.display = 'none';
            renderSavedDrafts();
        }
    }

    function saveDraft() {
        const s = getSettings();
        const text = document.getElementById('wfm-editor')?.value?.trim();
        if (!text) { window.toastr?.warning('Nothing to save — draft is empty.'); return; }
        if (!s.wfm_saved_drafts) s.wfm_saved_drafts = [];
        s.wfm_saved_drafts.unshift({ text, saved_at: Date.now() });
        save();
        window.toastr?.success('Draft saved!');
        const btn = document.getElementById('wfm-save-draft-btn');
        if (btn) {
            btn.querySelector('i')?.classList.replace('fa-regular', 'fa-solid');
            setTimeout(() => btn.querySelector('i')?.classList.replace('fa-solid', 'fa-regular'), 1000);
        }
    }

    function renderSavedDrafts() {
        const s = getSettings();
        const list = document.getElementById('wfm-saved-list');
        if (!list) return;
        list.innerHTML = '';
        if (!s.wfm_saved_drafts?.length) {
            list.innerHTML = '<div class="ri-no-presets">No saved drafts yet.<br>Hit 🔖 on a draft to save it.</div>';
            return;
        }
        s.wfm_saved_drafts.forEach((draft, idx) => {
            const item = document.createElement('div');
            item.className = 'ri-preset-item';
            const preview = draft.text.slice(0, 100) + (draft.text.length > 100 ? '…' : '');
            item.innerHTML = `
                <div class="ri-preset-preview">${escapeHtml(preview)}</div>
                <div class="ri-preset-actions">
                    <button class="wfm-saved-load menu_button" data-idx="${idx}">Load</button>
                    <button class="wfm-saved-delete menu_button ri-btn-danger" data-idx="${idx}">Delete</button>
                </div>`;
            list.appendChild(item);
        });
        list.querySelectorAll('.wfm-saved-load').forEach(btn => {
            btn.addEventListener('click', () => {
                const draft = getSettings().wfm_saved_drafts[parseInt(btn.dataset.idx)];
                if (!draft) return;
                wfmDrafts.push(draft.text);
                wfmCurrentDraft = wfmDrafts.length - 1;
                updateDraftNav();
                switchWfmTab('draft');
            });
        });
        list.querySelectorAll('.wfm-saved-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                getSettings().wfm_saved_drafts.splice(parseInt(btn.dataset.idx), 1);
                save(); renderSavedDrafts();
            });
        });
    }

    function updateDraftNav() {
        const counter = document.getElementById('wfm-draft-counter');
        const prevBtn = document.getElementById('wfm-prev-draft');
        const nextBtn = document.getElementById('wfm-next-draft');
        const saveBtn = document.getElementById('wfm-save-draft-btn');
        if (!counter) return;
        if (!wfmDrafts.length) {
            counter.textContent = 'No drafts';
            if (prevBtn) prevBtn.disabled = true;
            if (nextBtn) nextBtn.disabled = true;
            if (saveBtn) saveBtn.disabled = true;
            return;
        }
        counter.textContent = `${wfmCurrentDraft + 1} / ${wfmDrafts.length}`;
        if (prevBtn) prevBtn.disabled = wfmCurrentDraft <= 0;
        if (nextBtn) nextBtn.disabled = wfmCurrentDraft >= wfmDrafts.length - 1;
        if (saveBtn) saveBtn.disabled = false;
        const editor = document.getElementById('wfm-editor');
        if (editor) editor.value = wfmDrafts[wfmCurrentDraft];
    }

    function commitWfmDraft() {
        const editor = document.getElementById('wfm-editor');
        const stTextarea = document.getElementById('send_textarea');
        if (!editor || !stTextarea) return;
        stTextarea.value = editor.value;
        stTextarea.dispatchEvent(new Event('input', { bubbles: true }));
        hideAll();
    }

    const WFM_PRESET_INJECT_ID = 'ss_wfm_preset_context';
    const WFM_SYSTEM_INJECT_ID = 'ss_wfm_system';

    function getPresetBlocks() {
        const prompts = window.oai_settings?.prompts ?? [];
        return prompts
            .filter(p => p.enabled && !p.marker && p.content?.trim())
            .map(p => p.content.trim());
    }

    async function generateWfmDraft() {
        if (wfmGenerating) return;
        const c = ctx();
        if (!c.generateRaw) { window.toastr?.error('generateRaw not available.'); return; }

        const s = getSettings();
        const tpls = { ...DEFAULT_TEMPLATES, ...s.templates };

        const instruction  = document.getElementById('wfm-instruction')?.value?.trim() || '';
        const charName     = c.name2 || 'the character';
        const userName     = c.name1 || 'User';
        const currentDraft = document.getElementById('wfm-editor')?.value?.trim() || '';

        const recentMessages = (c.chat || []).slice(-10)
            .map(m => `${m.is_user ? userName : charName}: ${m.mes}`)
            .join('\n');

        const vars = {
            user:      userName,
            char:      charName,
            context:   recentMessages || '(No recent messages)',
            draft:     currentDraft,
            direction: instruction || 'Continue the scene naturally.',
        };

        const systemPrompt  = renderTemplate(tpls.system_prompt, vars);
        const userPromptTpl = currentDraft ? tpls.rewrite_prompt : tpls.scratch_prompt;
        const userPrompt    = renderTemplate(userPromptTpl, vars);

        wfmGenerating = true;
        const genBtn = document.getElementById('wfm-generate-btn');
        if (genBtn) { genBtn.disabled = true; genBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }

        try {
            // Inject preset context blocks if enabled
            if (s.wfm_include_preset) {
                const blocks = getPresetBlocks();
                if (blocks.length) {
                    const presetContent = blocks.join('\n\n').replace(/\|/g, '\\|');
                    await c.executeSlashCommandsWithOptions(
                        `/inject id=${WFM_PRESET_INJECT_ID} position=chat depth=999 role=system ${presetContent}`,
                        { showOutput: false }
                    );
                }
            }

            // Inject ghostwriter system prompt
            const escapedSystem = systemPrompt.replace(/\|/g, '\\|');
            await c.executeSlashCommandsWithOptions(
                `/inject id=${WFM_SYSTEM_INJECT_ID} position=chat depth=0 role=system ${escapedSystem}`,
                { showOutput: false }
            );

            const result = await c.generateRaw({
                prompt: userPrompt,
                quietToLoud: false,
                instructOverride: false,
            });

            const text = (typeof result === 'string' ? result : result?.text || '').trim();
            if (text) {
                wfmDrafts.push(text);
                wfmCurrentDraft = wfmDrafts.length - 1;
                updateDraftNav();
            } else {
                window.toastr?.warning('Generation returned empty — try again.');
            }
        } catch (err) {
            console.error('[SS] WFM error:', err?.message || err);
            window.toastr?.error(`Generation failed: ${err?.message || 'unknown error'}`);
        } finally {
            // Always clean up injections
            await c.executeSlashCommandsWithOptions(`/inject id=${WFM_SYSTEM_INJECT_ID}`, { showOutput: false }).catch(() => {});
            await c.executeSlashCommandsWithOptions(`/inject id=${WFM_PRESET_INJECT_ID}`, { showOutput: false }).catch(() => {});
            wfmGenerating = false;
            if (genBtn) { genBtn.disabled = false; genBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate'; }
        }
    }

    // ── UI Injection ──────────────────────────────────────────────────────────
    function injectUI() {
        if (document.getElementById('ri-bar')) return;
        const sendForm = document.getElementById('send_form');
        if (!sendForm) { console.error('[SS] #send_form not found'); return; }

        const s = getSettings();
        const isSimple = s.ri_mode === 'simple';

        // ── Bar ──
        const bar = document.createElement('div');
        bar.id = 'ri-bar';
        bar.className = 'ri-bar';
        bar.innerHTML = `
            <button class="ri-bar-btn" id="ri-bar-ri-btn" title="Response Instructions">
                <i class="fa-solid fa-scroll"></i>
                <span id="ri-status-dot" class="ri-status-dot"></span>
            </button>
            <div class="ri-bar-divider"></div>
            <button class="ri-bar-btn" id="ri-bar-wfm-btn" title="Write For Me">
                <i class="fa-solid fa-wand-magic-sparkles"></i>
            </button>`;
        sendForm.parentNode.insertBefore(bar, sendForm);

        // ── RI Panel ──
        const riPanel = document.createElement('div');
        riPanel.id = 'ri-panel';
        riPanel.className = 'ri-panel';
        riPanel.style.display = 'none';
        riPanel.innerHTML = `
            <div class="ri-panel-header">
                <span class="ri-panel-title"><i class="fa-solid fa-scroll"></i> Response Instructions</span>
                <div class="ri-panel-controls">
                    <label class="ri-toggle-label" title="Enable/disable">
                        <input type="checkbox" id="ri-toggle" ${s.enabled ? 'checked' : ''}>
                        <span class="ri-toggle-slider"></span>
                    </label>
                    <button id="ri-library-btn" class="ri-icon-btn" title="Presets">
                        <i class="fa-solid fa-folder-open"></i>
                    </button>
                    <button id="ri-clear-btn" class="ri-icon-btn" title="Clear">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                    <button id="ri-close-btn" class="ri-icon-btn" title="Close">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>
            <div class="ri-mode-toggle">
                <button id="ri-mode-simple" class="ri-mode-btn ${isSimple ? 'ri-mode-active' : ''}">Simple</button>
                <button id="ri-mode-custom" class="ri-mode-btn ${!isSimple ? 'ri-mode-active' : ''}">Custom</button>
            </div>
            <div id="ri-simple-area" style="display:${isSimple ? '' : 'none'}">
                <div class="ri-chips-label" style="margin-bottom:4px">Your own instructions</div>
                <textarea id="ri-simple-addon" class="ri-textarea ri-simple-addon"
                    placeholder="Anything else? e.g. {{companion}} loses his memories"
                >${escapeHtml(s.simple_custom_addon || '')}</textarea>
                <div id="ri-chips-container"></div>
                <p id="ri-preview" class="ri-preview" style="display:none"></p>
            </div>
            <div id="ri-custom-area" style="display:${!isSimple ? '' : 'none'}">
                <textarea id="ri-custom-textarea" class="ri-textarea"
                    placeholder="Write response instructions here… No character limit. Injected via /inject for the next reply."
                >${escapeHtml(s.custom_text || '')}</textarea>
            </div>`;
        bar.parentNode.insertBefore(riPanel, bar);

        // ── RI Library Panel ──
        const riLibPanel = document.createElement('div');
        riLibPanel.id = 'ri-lib-panel';
        riLibPanel.className = 'ri-panel';
        riLibPanel.style.display = 'none';
        riLibPanel.innerHTML = `
            <div class="ri-panel-header">
                <span class="ri-panel-title"><i class="fa-solid fa-folder-open"></i> RI Presets</span>
                <div class="ri-panel-controls">
                    <button id="ri-lib-back-btn" class="ri-icon-btn" title="Back">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <button id="ri-lib-close-btn" class="ri-icon-btn" title="Close">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>
            <div class="ri-lib-save-row">
                <input type="text" id="ri-preset-name-input" class="text_pole ri-name-input" placeholder="Preset name…" />
                <button id="ri-save-preset-btn" class="ri-icon-btn" title="Save current instructions">
                    <i class="fa-solid fa-floppy-disk"></i>
                </button>
            </div>
            <div id="ri-preset-list" class="ri-preset-list"></div>`;
        bar.parentNode.insertBefore(riLibPanel, bar);

        // ── WFM Panel ──
        const wfmPanel = document.createElement('div');
        wfmPanel.id = 'wfm-panel';
        wfmPanel.className = 'ri-panel wfm-panel';
        wfmPanel.style.display = 'none';
        wfmPanel.innerHTML = `
            <div class="ri-panel-header">
                <span class="ri-panel-title"><i class="fa-solid fa-wand-magic-sparkles"></i> Write For Me</span>
                <div class="ri-panel-controls">
                    <button id="wfm-lib-btn" class="ri-icon-btn" title="Instruction presets">
                        <i class="fa-solid fa-folder-open"></i>
                    </button>
                    <button id="wfm-tpl-btn" class="ri-icon-btn" title="Prompt Templates">
                        <i class="fa-solid fa-gear"></i>
                    </button>
                    <button id="wfm-close-btn" class="ri-icon-btn" title="Close">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>
            <div class="wfm-tab-bar">
                <button id="wfm-tab-draft" class="wfm-tab wfm-tab-active">Draft</button>
                <button id="wfm-tab-saved" class="wfm-tab">Saved</button>
            </div>
            <div id="wfm-draft-area">
                <div class="wfm-section-label" style="margin-top:4px">Your message</div>
                <textarea id="wfm-editor" class="ri-textarea wfm-editor"
                    placeholder="Generated message appears here. You can also type or edit directly…"></textarea>
                <div class="wfm-draft-nav">
                    <button id="wfm-prev-draft" class="ri-icon-btn" disabled>
                        <i class="fa-solid fa-chevron-left"></i>
                    </button>
                    <span id="wfm-draft-counter" class="wfm-draft-counter">No drafts</span>
                    <button id="wfm-next-draft" class="ri-icon-btn" disabled>
                        <i class="fa-solid fa-chevron-right"></i>
                    </button>
                    <button id="wfm-save-draft-btn" class="ri-icon-btn" title="Save draft" disabled>
                        <i class="fa-regular fa-bookmark"></i>
                    </button>
                </div>
                <div class="wfm-section-label">Instruction</div>
                <textarea id="wfm-instruction" class="ri-textarea wfm-instruction"
                    placeholder="e.g. 'act shy and nervous', 'confess my feelings'…"></textarea>
                <label class="wfm-preset-toggle-row" title="Prepend enabled prompt blocks from your active CC preset into the generation context">
                    <input type="checkbox" id="wfm-include-preset" ${s.wfm_include_preset ? 'checked' : ''}>
                    <span class="wfm-preset-toggle-label">Include preset context</span>
                </label>
                <div class="wfm-footer">
                    <button id="wfm-generate-btn" class="menu_button wfm-btn-generate">
                        <i class="fa-solid fa-wand-magic-sparkles"></i> Generate
                    </button>
                    <button id="wfm-use-btn" class="menu_button wfm-btn-use">
                        <i class="fa-solid fa-check"></i> Use this
                    </button>
                </div>
            </div>
            <div id="wfm-saved-area" style="display:none">
                <div id="wfm-saved-list" class="ri-preset-list" style="margin-top:6px"></div>
            </div>`;
        bar.parentNode.insertBefore(wfmPanel, bar);

        // ── WFM Library Panel ──
        const wfmLibPanel = document.createElement('div');
        wfmLibPanel.id = 'wfm-lib-panel';
        wfmLibPanel.className = 'ri-panel';
        wfmLibPanel.style.display = 'none';
        wfmLibPanel.innerHTML = `
            <div class="ri-panel-header">
                <span class="ri-panel-title"><i class="fa-solid fa-folder-open"></i> WFM Presets</span>
                <div class="ri-panel-controls">
                    <button id="wfm-lib-back-btn" class="ri-icon-btn" title="Back">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <button id="wfm-lib-close-btn" class="ri-icon-btn" title="Close">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>
            <div class="ri-lib-save-row">
                <input type="text" id="wfm-preset-name-input" class="text_pole ri-name-input" placeholder="Preset name…" />
                <button id="wfm-save-preset-btn" class="ri-icon-btn" title="Save current instruction">
                    <i class="fa-solid fa-floppy-disk"></i>
                </button>
            </div>
            <div id="wfm-preset-list" class="ri-preset-list"></div>`;
        bar.parentNode.insertBefore(wfmLibPanel, bar);

        // ── Templates Panel ──
        const tplPanel = document.createElement('div');
        tplPanel.id = 'tpl-panel';
        tplPanel.className = 'ri-panel';
        tplPanel.style.display = 'none';
        const tpls = { ...DEFAULT_TEMPLATES, ...s.templates };
        tplPanel.innerHTML = `
            <div class="ri-panel-header">
                <span class="ri-panel-title"><i class="fa-solid fa-gear"></i> Prompt Templates</span>
                <div class="ri-panel-controls">
                    <button id="tpl-reset-btn" class="ri-icon-btn" title="Reset to defaults">
                        <i class="fa-solid fa-rotate-left"></i>
                    </button>
                    <button id="tpl-close-btn" class="ri-icon-btn" title="Close">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>
            <div class="ri-tpl-body">
                <div class="ri-tpl-help">
                    Variables: <code>{{user}}</code>, <code>{{char}}</code>, <code>{{context}}</code>, <code>{{draft}}</code>, <code>{{direction}}</code>
                </div>
                <div class="ri-tpl-field">
                    <div class="ri-tpl-label">System Directive</div>
                    <textarea id="tpl-system" class="ri-textarea ri-tpl-ta">${escapeHtml(tpls.system_prompt)}</textarea>
                </div>
                <div class="ri-tpl-field">
                    <div class="ri-tpl-label">Rewrite / Enhance Template (When Draft Exists)</div>
                    <textarea id="tpl-rewrite" class="ri-textarea ri-tpl-ta">${escapeHtml(tpls.rewrite_prompt)}</textarea>
                </div>
                <div class="ri-tpl-field">
                    <div class="ri-tpl-label">Scratch Generation Template (When Draft is Blank)</div>
                    <textarea id="tpl-scratch" class="ri-textarea ri-tpl-ta">${escapeHtml(tpls.scratch_prompt)}</textarea>
                </div>
            </div>`;
        bar.parentNode.insertBefore(tplPanel, bar);

        // ── Wire: bar buttons ──
        addTapListener(document.getElementById('ri-bar-ri-btn'), () => {
            if (riPanel.style.display === 'none') {
                showPanel('ri-panel');
            } else {
                hideAll();
            }
        });
        addTapListener(document.getElementById('ri-bar-wfm-btn'), () => {
            if (wfmPanel.style.display === 'none') {
                const stTextarea = document.getElementById('send_textarea');
                const editor = document.getElementById('wfm-editor');
                if (editor && stTextarea?.value?.trim() && !editor.value) editor.value = stTextarea.value;
                showPanel('wfm-panel');
                updateDraftNav();
            } else {
                hideAll();
            }
        });

        // ── Wire: RI panel ──
        document.getElementById('ri-toggle').addEventListener('change', async e => {
            s.enabled = e.target.checked;
            await updatePromptInjection(); updateIndicator(); save();
        });

        document.getElementById('ri-mode-simple').addEventListener('click', () => setMode('simple'));
        document.getElementById('ri-mode-custom').addEventListener('click', () => setMode('custom'));

        // Simple addon textarea
        document.getElementById('ri-simple-addon').addEventListener('input', async e => {
            s.simple_custom_addon = e.target.value;
            refreshPreview(); updateIndicator(); save();
            await updatePromptInjection();
        });

        // Custom textarea
        document.getElementById('ri-custom-textarea').addEventListener('input', async e => {
            s.custom_text = e.target.value;
            updateIndicator(); save();
            await updatePromptInjection();
        });

        document.getElementById('ri-clear-btn').addEventListener('click', async () => {
            s.enabled = false;
            s.simple_selections = {};
            s.simple_custom_addon = '';
            s.custom_text = '';
            document.getElementById('ri-toggle').checked = false;
            document.getElementById('ri-simple-addon').value = '';
            document.getElementById('ri-custom-textarea').value = '';
            renderChips();
            refreshPreview();
            await updatePromptInjection(); updateIndicator(); save();
        });

        document.getElementById('ri-close-btn').addEventListener('click', hideAll);
        document.getElementById('ri-library-btn').addEventListener('click', () => {
            renderPresets(); showPanel('ri-lib-panel');
        });

        // ── Wire: RI library ──
        document.getElementById('ri-lib-back-btn').addEventListener('click', () => showPanel('ri-panel'));
        document.getElementById('ri-lib-close-btn').addEventListener('click', hideAll);
        document.getElementById('ri-save-preset-btn').addEventListener('click', saveRiPreset);

        // ── Wire: WFM panel ──
        document.getElementById('wfm-close-btn').addEventListener('click', hideAll);
        document.getElementById('wfm-generate-btn').addEventListener('click', generateWfmDraft);
        document.getElementById('wfm-use-btn').addEventListener('click', commitWfmDraft);
        document.getElementById('wfm-include-preset').addEventListener('change', e => {
            s.wfm_include_preset = e.target.checked; save();
        });
        document.getElementById('wfm-save-draft-btn').addEventListener('click', saveDraft);
        document.getElementById('wfm-tab-draft').addEventListener('click', () => switchWfmTab('draft'));
        document.getElementById('wfm-tab-saved').addEventListener('click', () => switchWfmTab('saved'));
        document.getElementById('wfm-prev-draft').addEventListener('click', () => {
            if (wfmCurrentDraft > 0) { wfmCurrentDraft--; updateDraftNav(); }
        });
        document.getElementById('wfm-next-draft').addEventListener('click', () => {
            if (wfmCurrentDraft < wfmDrafts.length - 1) { wfmCurrentDraft++; updateDraftNav(); }
        });
        document.getElementById('wfm-lib-btn').addEventListener('click', () => {
            renderWfmPresets(); showPanel('wfm-lib-panel');
        });
        document.getElementById('wfm-tpl-btn').addEventListener('click', () => showPanel('tpl-panel'));

        // ── Wire: WFM library ──
        document.getElementById('wfm-lib-back-btn').addEventListener('click', () => showPanel('wfm-panel'));
        document.getElementById('wfm-lib-close-btn').addEventListener('click', hideAll);
        document.getElementById('wfm-save-preset-btn').addEventListener('click', saveWfmPreset);

        // ── Wire: Templates panel ──
        document.getElementById('tpl-close-btn').addEventListener('click', hideAll);
        document.getElementById('tpl-reset-btn').addEventListener('click', () => {
            s.templates = { ...DEFAULT_TEMPLATES };
            document.getElementById('tpl-system').value  = DEFAULT_TEMPLATES.system_prompt;
            document.getElementById('tpl-rewrite').value = DEFAULT_TEMPLATES.rewrite_prompt;
            document.getElementById('tpl-scratch').value = DEFAULT_TEMPLATES.scratch_prompt;
            save();
            window.toastr?.success('Templates reset to defaults.');
        });
        document.getElementById('tpl-system').addEventListener('input', e => {
            if (!s.templates) s.templates = { ...DEFAULT_TEMPLATES };
            s.templates.system_prompt = e.target.value; save();
        });
        document.getElementById('tpl-rewrite').addEventListener('input', e => {
            if (!s.templates) s.templates = { ...DEFAULT_TEMPLATES };
            s.templates.rewrite_prompt = e.target.value; save();
        });
        document.getElementById('tpl-scratch').addEventListener('input', e => {
            if (!s.templates) s.templates = { ...DEFAULT_TEMPLATES };
            s.templates.scratch_prompt = e.target.value; save();
        });

        // ── Init ──
        if (isSimple) renderChips();
        refreshPreview();
        updateIndicator();
        console.log('[SS] UI injected');
    }

    // ── Boot ──────────────────────────────────────────────────────────────────
    async function tryInit() {
        if (!window.SillyTavern?.getContext) { setTimeout(tryInit, 200); return; }
        const c = ctx();
        if (!c.extensionSettings[EXT_NAME]) c.extensionSettings[EXT_NAME] = {};
        c.extensionSettings[EXT_NAME] = { ...defaultSettings, ...c.extensionSettings[EXT_NAME] };

        if (c.eventSource && c.eventTypes) {
            c.eventSource.on(c.eventTypes.APP_READY, () => injectUI());
            if (c.eventTypes.CHAT_CHANGED) {
                c.eventSource.on(c.eventTypes.CHAT_CHANGED, () => {
                    setTimeout(() => updatePromptInjection(), 300);
                });
            }
        }

        await updatePromptInjection();
        setTimeout(() => { if (!document.getElementById('ri-bar')) injectUI(); }, 500);
        setTimeout(() => { if (!document.getElementById('ri-bar')) injectUI(); }, 2000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryInit);
    } else {
        tryInit();
    }

})();
