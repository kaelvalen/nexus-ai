```markdown
# Design System Specification: The Kinetic Terminal

## 1. Overview & Creative North Star
**Creative North Star: "The Brutalist Command Line"**

This design system moves away from the "soft" consumer web and leans into the high-velocity, high-density world of the power user. It is inspired by Neovim configurations, kernel headers, and low-level debugging environments. 

The aesthetic is characterized by **Functional Density**. We do not fear information; we organize it through hyper-precise alignment and tonal layering. To avoid a "generic" dark mode, we utilize intentional asymmetry—placing heavy functional blocks against vast, empty dark voids—and replace traditional rounded UI metaphors with sharp, 0px radius geometries. This is an OS for architects of code, where every pixel must justify its existence.

---

## 2. Colors & Surface Architecture

### The Palette
The core of the system is the interplay between the deep obsidian background and the high-energy radioactive accents.

*   **Primary Background (`surface` / `background`):** `#080c10` – The void.
*   **Primary Accent (`primary_container`):** `#00ff88` – "Protocol Green." Used for success, execution, and active states.
*   **Secondary Accent (`secondary_container`):** `#00d4ff` – "Data Cyan." Used for information streams and secondary telemetry.
*   **Tertiary Accent (`on_tertiary_container`):** `#ff6b35` – "Warning Orange." Reserved for launcher tools and destructive actions.

### The "No-Line" Rule & Tonal Nesting
Standard UI uses borders to separate ideas. We use **Luminance Steps**.
*   **Prohibition:** Do not use 1px solid grey borders to define sections.
*   **The Execution:** Boundaries are defined by shifting between `surface_container_lowest` (#0a0f13) and `surface_container_high` (#262a2f). 
*   **Nesting:** A terminal buffer (Content Area) should sit at `surface_container_low`, while the surrounding sidebar resides at `surface_dim`. This creates a "recessed" look, mimicking a physical CRT monitor housing.

### Signature Textures
To provide "soul" to the darkness:
*   **Scanline Overlay:** A global fixed `::after` element with a repetitive linear-gradient (transparent 50%, rgba(0, 255, 136, 0.02) 50%) at 4px height to simulate a cathode-ray tube.
*   **Glow States:** Elements in a "Primary" state should have a subtle `0 0 15px rgba(0, 255, 136, 0.3)` box-shadow to simulate light bleed on a phosphor screen.

---

## 3. Typography: Monospace Authority

We utilize **JetBrains Mono** exclusively. Monospaced type creates a predictable grid, allowing for the "Functional Density" required by this system.

*   **Display & Headlines:** Use `display-md` (2.75rem) for system status. Track it tightly (-2%) to feel like a high-end editorial header.
*   **Body & Labels:** Use `body-sm` (0.75rem) for the majority of data. In a terminal aesthetic, small type conveys professional-grade complexity.
*   **Hierarchy through Case:** Use **ALL CAPS** for `label-sm` to denote system-level metadata (e.g., CPU load, Latency).

---

## 4. Elevation & Depth: Tonal Layering

In this design system, "Up" does not mean "Closer to the light," it means "More active."

*   **The Layering Principle:** Depth is achieved by stacking. A floating command palette should use `surface_container_highest` (#31353a) with no shadow, but a "Ghost Border" of `outline_variant` at 20% opacity.
*   **Glassmorphism:** For overlays (Modals/Launchers), use `surface_container` with a `backdrop-filter: blur(12px)`. This prevents the "pasted-on" look and makes the OS feel like a cohesive, multi-layered environment.
*   **The Ghost Border:** Instead of solid borders, use a 1px border with the `primary` token at 10% opacity. It should feel like a faint grid line on a blueprint, not a container wall.

---

## 5. Components

### Buttons
*   **Primary:** Sharp 0px corners. Background: `primary_container`. Text: `on_primary`. 
*   **Secondary:** Background: `transparent`. Border: 1px `secondary_container`.
*   **Interaction:** On hover, the button should "glitch"—a rapid 20ms horizontal offset or a color inversion.

### Input Fields (Terminal Buffers)
*   **Style:** No background fill. A bottom border of `outline_variant`.
*   **The Blinking Cursor:** All active inputs must feature a 8px wide, 100% opaque `primary` block cursor that pulses at 1Hz (`opacity: 0` to `opacity: 1`).

### Cards & Containers
*   **Forbid Dividers:** Do not use horizontal rules (`<hr>`). Separate content blocks using `48px` of vertical whitespace or a shift in the `surface_container` tier.
*   **Status Indicators:** Every card should have a 2px vertical "accent strip" on the far left using the `primary` or `tertiary` token to indicate status.

### Custom Component: The "Telemetry Ribbon"
A persistent 24px high bar at the very top or bottom of containers, using `surface_container_lowest`, displaying real-time system strings (e.g., `NVIM | UTF-8 | LINE 12:44`).

---

## 6. Do's and Don'ts

### Do
*   **Do Use Asymmetry:** Align the main terminal buffer to the left, but keep system telemetry floating in the top right.
*   **Do Embrace Density:** Use `0.875rem` for body text. Power users prefer seeing more data at once over "breathing room."
*   **Do Use Micro-animations:** Tab changes should feel like a terminal clearing—fast, instantaneous, or a subtle vertical "slide-up."

### Don't
*   **Don't Use Border Radius:** Anything other than 0px breaks the "Hacker" immersion.
*   **Don't Use Soft Shadows:** Deep, blurred shadows belong in consumer apps. In this system, depth is flat and tonal.
*   **Don't Use Gradients for Depth:** Use solid color shifts. Gradients are only permitted for "Glow" effects or the Scanline texture.

---

## 7. Accessibility
While the aesthetic is dark, readability is non-negotiable. 
*   Ensure all `on_surface` text vs `background` meets WCAG AA standards. 
*   The `primary` accent (#00ff88) must never be used for long-form body text; it is for triggers and status only. 
*   Provide a "High Contrast" toggle that removes the Scanline texture for users with visual sensitivities.```