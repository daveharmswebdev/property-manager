---
description: "Generate Excalidraw diagrams: flowcharts, wireframes, architecture, and dataflow"
---

# Create Excalidraw Diagram

## Context

Generate Excalidraw-format diagrams for architecture visualization, wireframes, flowcharts, and data flow diagrams. Output is a `.excalidraw` JSON file that can be opened in Excalidraw (desktop app, VS Code extension, or excalidraw.com).

## Process

### Step 1: Determine diagram type

Ask the user what they need (or infer from context):

1. **Architecture diagram** — system components, layers, services, and their relationships
2. **Wireframe** — page layout mockup for a specific view
3. **Flowchart** — process flow, decision trees, user journeys
4. **Data flow diagram** — how data moves through the system (DFD)

### Step 2: Gather requirements

Based on type:

**Architecture**: Which components to show? What level of detail (high-level system, or detailed component)?  Load `docs/project/architecture.md` for reference.

**Wireframe**: Which page/view? Load `docs/project/ux-design-specification.md` for design patterns. What elements need to be shown?

**Flowchart**: What process? What are the start/end conditions? What decision points exist?

**Data flow**: What entities? What transformations? Load `docs/project/prd.md` for data model context.

### Step 3: Generate the diagram

Create a valid Excalidraw JSON file with:
- Clear, readable labels
- Logical layout (top-to-bottom for flows, left-to-right for architectures)
- Consistent styling (colors from UX spec if available)
- Proper arrow connections between elements
- Grouped related elements

The Excalidraw JSON format uses:
- `elements[]` — array of shapes, text, arrows
- Each element has: `type`, `x`, `y`, `width`, `height`, `text`, `strokeColor`, `backgroundColor`
- Arrows use `startBinding` and `endBinding` to connect to other elements
- Use `roughness: 1` for the hand-drawn Excalidraw aesthetic

### Step 4: Save and present

Save to `docs/project/diagrams/{diagram-name}.excalidraw`

Tell the user how to view it:
- VS Code: Install "Excalidraw" extension, open the file
- Web: Upload to excalidraw.com
- Desktop: Open with Excalidraw desktop app

## Validation Gates

- [ ] Diagram is valid Excalidraw JSON
- [ ] All elements are labeled clearly
- [ ] Connections/arrows are properly bound
- [ ] Layout is readable without overlapping
