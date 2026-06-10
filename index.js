// Response Instructions + Write For Me
// SillyTavern Extension — fully inline, no modals

(function () {
    'use strict';

    const EXT_NAME = 'response-instructions';
    const PROMPT_KEY = 'response_instructions_injection';

    const defaultSettings = {
        enabled: false,
        text: '',
        presets: [],
        wfm_presets: [],
    };

    function ctx() { return window.SillyTavern.getContext(); }
    function save() { ctx().saveSettingsDebounced(); }

    function getSettings() {
        const s = ctx().extensionSettings;
        if (!s[EXT_NAME]) s[EXT_NAME] = { ...defaultSettings };
        for (const k of Object.keys(defaultSettings)) {
            if (s[EXT_NAME][k] === undefined) s[EXT_NAME][k] = defaultSettings[k];
        }
        return s[EXT_NAME];
    }

    // ── Prompt injection ──────────────────────────────────────────────────────
    function updatePromptInjection() {
        const s = getSettings();
        const c = ctx();
        if (s.enabled && s.text?.trim()) {
            const wrapped = `[RESPONSE INSTRUCTIONS — FOLLOW EXACTLY:\n${s.text.trim()}\n]`;
            // Position 4 = bottom of prompt, last thing before generation
            c.setExtensionPrompt(PROMPT_KEY, wrapped, 4, 0, true);
        } else {
            c.setExtensionPrompt(PROMPT_KEY, '', 4, 0, false);
        }
    }

    function updateIndicator() {
        const s = getSettings();
        document.getElementById('ri-status-dot')
            ?.classList.toggle('ri-dot-active', !!(s.enabled && s.text?.trim()));
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
    // Only one panel visible at a time (ri, ri-lib, wfm, wfm-lib)
    const PANELS = ['ri-panel', 'ri-lib-panel', 'wfm-panel', 'wfm-lib-panel'];

    function showPanel(id) {
        PANELS.forEach(p => {
            const el = document.getElementById(p);
            if (el) el.classList.toggle('ri-hidden', p !== id);
        });
    }

    function hideAll() {
        PANELS.forEach(p => document.getElementById(p)?.classList.add('ri-hidden'));
    }

    function togglePanel(id) {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.classList.contains('ri-hidden')) {
            showPanel(id);
        } else {
            hideAll();
        }
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
            btn.addEventListener('click', () => {
                const s = getSettings();
                const preset = s.presets[parseInt(btn.dataset.idx)];
                if (!preset) return;
                const ta = document.getElementById('ri-textarea');
                if (ta) ta.value = preset.text;
                s.text = preset.text;
                updatePromptInjection(); updateIndicator(); save();
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
        const text = s.text?.trim();
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

    function commitWfmDraft() {
        const editor = document.getElementById('wfm-editor');
        const stTextarea = document.getElementById('send_textarea');
        if (!editor || !stTextarea) return;
        stTextarea.value = editor.value;
        stTextarea.dispatchEvent(new Event('input', { bubbles: true }));
        hideAll();
    }

    function updateDraftNav() {
        const counter = document.getElementById('wfm-draft-counter');
        const prevBtn = document.getElementById('wfm-prev-draft');
        const nextBtn = document.getElementById('wfm-next-draft');
        if (!counter) return;
        if (!wfmDrafts.length) {
            counter.textContent = 'No drafts';
            if (prevBtn) prevBtn.disabled = true;
            if (nextBtn) nextBtn.disabled = true;
            return;
        }
        counter.textContent = `${wfmCurrentDraft + 1} / ${wfmDrafts.length}`;
        if (prevBtn) prevBtn.disabled = wfmCurrentDraft <= 0;
        if (nextBtn) nextBtn.disabled = wfmCurrentDraft >= wfmDrafts.length - 1;
        const editor = document.getElementById('wfm-editor');
        if (editor) editor.value = wfmDrafts[wfmCurrentDraft];
    }

    async function generateWfmDraft() {
        if (wfmGenerating) return;
        const c = ctx();
        if (!c.generateRaw) { window.toastr?.error('generateRaw not available.'); return; }

        const instruction = document.getElementById('wfm-instruction')?.value?.trim() || '';
        const charName = c.name2 || 'the character';
        const userName = c.name1 || 'User';

        const recentMessages = (c.chat || []).slice(-10).map(m =>
            `${m.is_user ? userName : charName}: ${m.mes}`
        ).join('\n');

        let prompt = `[Write ${userName}'s next message in this roleplay with ${charName}. Write ONLY the message content, no labels or preamble.`;
        if (instruction) prompt += ` Instruction: ${instruction}.`;
        prompt += `]\n\n`;
        if (recentMessages) prompt += `Recent conversation:\n${recentMessages}\n\n`;
        prompt += `${userName}:`;

        wfmGenerating = true;
        const genBtn = document.getElementById('wfm-generate-btn');
        if (genBtn) { genBtn.disabled = true; genBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }

        try {
            const result = await c.generateRaw({
                prompt,
                quietToLoud: false,
                instructOverride: false,
                systemPrompt: `You are helping ${userName} write their next message in a roleplay with ${charName}. Write ONLY the message content, no labels or preamble.`,
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
            console.error('[RI] WFM error:', err?.message || err);
            window.toastr?.error(`Generation failed: ${err?.message || 'unknown error'}`);
        } finally {
            wfmGenerating = false;
            if (genBtn) { genBtn.disabled = false; genBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i>'; }
        }
    }

    // ── UI Injection ──────────────────────────────────────────────────────────
    function injectUI() {
        if (document.getElementById('ri-bar')) return;
        const sendForm = document.getElementById('send_form');
        if (!sendForm) { console.error('[RI] #send_form not found'); return; }

        const s = getSettings();

        // ── Bar (icons only) ──
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
        riPanel.className = 'ri-panel' + (s.text ? '' : ' ri-hidden');
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
            <textarea id="ri-textarea" class="ri-textarea"
                placeholder="Write response instructions here… No character limit. Injected as a system prompt for the next reply."
            >${escapeHtml(s.text || '')}</textarea>`;
        bar.parentNode.insertBefore(riPanel, bar);

        // ── RI Library Panel ──
        const riLibPanel = document.createElement('div');
        riLibPanel.id = 'ri-lib-panel';
        riLibPanel.className = 'ri-panel ri-hidden';
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
        wfmPanel.className = 'ri-panel ri-hidden wfm-panel';
        wfmPanel.innerHTML = `
            <div class="ri-panel-header">
                <span class="ri-panel-title"><i class="fa-solid fa-wand-magic-sparkles"></i> Write For Me</span>
                <div class="ri-panel-controls">
                    <button id="wfm-lib-btn" class="ri-icon-btn" title="Instruction presets">
                        <i class="fa-solid fa-folder-open"></i>
                    </button>
                    <button id="wfm-close-btn" class="ri-icon-btn" title="Close">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>
            <div class="wfm-section-label">Your message</div>
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
            </div>
            <div class="wfm-section-label">Instruction</div>
            <textarea id="wfm-instruction" class="ri-textarea wfm-instruction"
                placeholder="e.g. 'act shy and nervous', 'confess my feelings'…"></textarea>
            <div class="wfm-footer">
                <button id="wfm-generate-btn" class="menu_button wfm-btn-generate">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> Generate
                </button>
                <button id="wfm-use-btn" class="menu_button wfm-btn-use">
                    <i class="fa-solid fa-check"></i> Use this
                </button>
            </div>`;
        bar.parentNode.insertBefore(wfmPanel, bar);

        // ── WFM Library Panel ──
        const wfmLibPanel = document.createElement('div');
        wfmLibPanel.id = 'wfm-lib-panel';
        wfmLibPanel.className = 'ri-panel ri-hidden';
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

        // ── Wire up bar ──
        addTapListener(document.getElementById('ri-bar-ri-btn'), () => togglePanel('ri-panel'));
        addTapListener(document.getElementById('ri-bar-wfm-btn'), () => {
            const stTextarea = document.getElementById('send_textarea');
            const editor = document.getElementById('wfm-editor');
            if (editor && stTextarea?.value?.trim() && !editor.value) editor.value = stTextarea.value;
            if (document.getElementById('wfm-panel').classList.contains('ri-hidden')) {
                showPanel('wfm-panel'); updateDraftNav();
            } else {
                hideAll();
            }
        });

        // ── Wire up RI panel ──
        const riTextarea = document.getElementById('ri-textarea');
        riTextarea.addEventListener('input', () => {
            s.text = riTextarea.value;
            updatePromptInjection(); updateIndicator(); save();
        });
        document.getElementById('ri-toggle').addEventListener('change', e => {
            s.enabled = e.target.checked;
            updatePromptInjection(); updateIndicator(); save();
        });
        document.getElementById('ri-clear-btn').addEventListener('click', () => {
            riTextarea.value = ''; s.text = ''; s.enabled = false;
            document.getElementById('ri-toggle').checked = false;
            updatePromptInjection(); updateIndicator(); save();
        });
        document.getElementById('ri-close-btn').addEventListener('click', hideAll);
        document.getElementById('ri-library-btn').addEventListener('click', () => {
            renderPresets(); showPanel('ri-lib-panel');
        });

        // ── Wire up RI library panel ──
        document.getElementById('ri-lib-back-btn').addEventListener('click', () => showPanel('ri-panel'));
        document.getElementById('ri-lib-close-btn').addEventListener('click', hideAll);
        document.getElementById('ri-save-preset-btn').addEventListener('click', saveRiPreset);

        // ── Wire up WFM panel ──
        document.getElementById('wfm-close-btn').addEventListener('click', hideAll);
        document.getElementById('wfm-generate-btn').addEventListener('click', generateWfmDraft);
        document.getElementById('wfm-use-btn').addEventListener('click', commitWfmDraft);
        document.getElementById('wfm-lib-btn').addEventListener('click', () => {
            renderWfmPresets(); showPanel('wfm-lib-panel');
        });
        document.getElementById('wfm-prev-draft').addEventListener('click', () => {
            if (wfmCurrentDraft > 0) { wfmCurrentDraft--; updateDraftNav(); }
        });
        document.getElementById('wfm-next-draft').addEventListener('click', () => {
            if (wfmCurrentDraft < wfmDrafts.length - 1) { wfmCurrentDraft++; updateDraftNav(); }
        });

        // ── Wire up WFM library panel ──
        document.getElementById('wfm-lib-back-btn').addEventListener('click', () => showPanel('wfm-panel'));
        document.getElementById('wfm-lib-close-btn').addEventListener('click', hideAll);
        document.getElementById('wfm-save-preset-btn').addEventListener('click', saveWfmPreset);

        updateIndicator();
        console.log('[RI] UI injected successfully');
    }

    // ── Boot ──────────────────────────────────────────────────────────────────
    function tryInit() {
        if (!window.SillyTavern?.getContext) { setTimeout(tryInit, 200); return; }
        const c = ctx();
        if (!c.extensionSettings[EXT_NAME]) c.extensionSettings[EXT_NAME] = {};
        c.extensionSettings[EXT_NAME] = { ...defaultSettings, ...c.extensionSettings[EXT_NAME] };
        updatePromptInjection();
        if (c.eventSource && c.eventTypes) {
            c.eventSource.on(c.eventTypes.APP_READY, () => injectUI());
        }
        setTimeout(() => { if (!document.getElementById('ri-bar')) injectUI(); }, 500);
        setTimeout(() => { if (!document.getElementById('ri-bar')) injectUI(); }, 2000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryInit);
    } else {
        tryInit();
    }

})();
