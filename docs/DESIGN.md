# Editor design

The implementation follows the generated full-screen concept in `editor-concept.png`: a white three-column shell, purple accent, visual preset thumbnails, fitted presentation canvas, compact inspector sections, and a playback/media strip.

Core tokens: accent `#7952e7`, text `#21212b`, border `#e9e9ef`, white surfaces, cool-gray studio background. Inter is the UI family with system fallbacks. The primary canvas uses a lavender/cream gradient in Clean Hero; exported backgrounds are independent of editor chrome.

The concept's product layout is retained, with functional additions for layout/image assignment, crop controls, favorites, file management, and export quality. The video canvas preserves actual output proportions; the generated concept depicted a taller canvas than a true 16:9 rectangle. Small screens use drawers to keep the canvas visible. No generated image is used as an interface screenshot: controls, panels, state, and preview are live components.

The built-in image generation prompts requested a complete MockupMotion editor inspired by shots.so, with a light shell, purple accent, eight presets, settings inspector, architecture screenshot canvas, playback, and upload strip; and a separate flat Aurelia architecture website screenshot with the text “Spaces for living.” and a lake-house interior photograph. Both were generated with the built-in image tool. UI icons use Lucide, with a film mark suitable for the app.
