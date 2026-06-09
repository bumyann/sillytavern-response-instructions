# Response Instructions + Write For Me
Tired of Saucepan's 500 character limit? Me too. This adds response instructions (inject a quick prompt before the ai replies) and a write-for-me panel (let the ai draft your user message) straight into ST. Presets, no character limits, mobile friendly.

Made this bc I loved Saucepan's Response Instructions and Write For Me UI too much but kept getting pulled back to ST for how customizable it is — so I just. made it myself. now I don't have to choose lol.

Disclaimer: I didn't actually make it. This shit is vibe-coded to the max. But I did test it before publishing it because I'm not a rat. Also, I'm aware Guided Generations, Impersonate, etc. exists but I want something simpler and ultra-speciific because I'm funny like that </3 Do what you will with this information.

---

## Features
### 📜 Response Instructions
- Persistent instruction panel above the chat input
- Write steering instructions for the AI's next reply — **no character limit**
- Toggle to enable/disable without clearing your text
- Green dot indicator on the bar when active
- Preset library — save, rename, load, and delete named instruction sets
- Injected as a system message at Author's Note depth (highest influence position)
- Persists until you manually clear it

### 🪄 Write For Me (Not to be confused with the Extensions button)
- AI-powered message drafting panel, also above the chat input
- Optionally write an instruction to steer how your message is written
- Hit **Generate** — uses your currently connected ST API and model
- Browse multiple drafts with ← → navigation
- Edit the result directly before using it
- Hit **Use this** to push the draft into the chat input, then send normally
- Separate preset library, fully independent from Response Instructions
---

## Installation
1. In ST, go to **Extensions** → **Install extension**
2. Paste: `https://github.com/bumyann/sillytavern-response-instructions`
3. Click **Save** — ST installs it automatically
4. Enable it in the Extensions list

---

## Usage
Both features live in a bar just above the chat input.

**Response Instructions:**
- Click **Instructions** to expand the panel
- Type whatever you want — no limit
- Toggle **ON** → green dot appears, instructions inject on the next send
- 📁 folder icon → preset library
- 🗑️ trash icon → clear instructions
- ✕ → collapse the panel (stays active if toggled on)

**Write For Me:**
- Click **Write For Me** to expand the panel
- Optionally add an instruction e.g. *"act nervous and avoid eye contact"*
- **Generate** → AI drafts a message using your current chat context
- Generate again for another draft, browse with ← →
- Edit freely, then **Use this** → copied into chat input, ready to send

---

## Custom Themes
Adapts automatically to whatever ST theme you have active via `--SmartTheme*` CSS variables. Want to customise it further for your own theme? Target `.ri-bar`, `.ri-panel`, `.wfm-panel`, `.ri-modal-inner` etc. in your theme's custom CSS.

---

## Screenshots
### Mobile
<img width="500" alt="Screenshot_2026-06-09-22-17-18-91_40deb401b9ffe8e1df2f1cc5ba480b12 1" src="https://github.com/user-attachments/assets/8999d25e-13af-4ff2-8ede-37a841c2fe35" />
<img width="500" alt="Screenshot_2026-06-09-22-17-13-86_40deb401b9ffe8e1df2f1cc5ba480b12 1" src="https://github.com/user-attachments/assets/f98224b1-6a02-481d-a837-d34612fe0190" />
<img width="333" alt="Screenshot_2026-06-09-22-17-07-84_40deb401b9ffe8e1df2f1cc5ba480b12 1" src="https://github.com/user-attachments/assets/7f29de1d-a209-40a0-bad6-3d97790fc903" />
<img width="333" alt="Screenshot_2026-06-09-22-17-03-01_40deb401b9ffe8e1df2f1cc5ba480b12 1" src="https://github.com/user-attachments/assets/86003cd8-2f48-462f-ac71-7488aa61ccb2" />
<img width="333" alt="Screenshot_2026-06-09-22-16-59-72_40deb401b9ffe8e1df2f1cc5ba480b12 1" src="https://github.com/user-attachments/assets/298d646b-e8b5-480f-9585-d56e35a0d4d4" />

### Desktop
<img width="500" alt="Screenshot 2026-06-09 222714" src="https://github.com/user-attachments/assets/d39a4ed5-82cc-4b63-89d3-a75bf05218e3" />
<img width="500" alt="Screenshot 2026-06-09 222730" src="https://github.com/user-attachments/assets/df0ffc60-3583-4cd0-8a03-14047f384f57" />
<img width="500" alt="Screenshot 2026-06-09 222806" src="https://github.com/user-attachments/assets/424f2170-8f20-4c64-968b-b98cf18ef437" />
<img width="500" alt="Screenshot 2026-06-09 222749" src="https://github.com/user-attachments/assets/c2dbb578-7a2d-4bac-bed5-78345d902b4c" />


